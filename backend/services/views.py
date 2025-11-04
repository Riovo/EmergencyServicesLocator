from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.renderers import JSONRenderer, BrowsableAPIRenderer
from django.contrib.gis.geos import Point
from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.measure import D
from .models import EmergencyService
from .serializers import EmergencyServiceSerializer


class EmergencyServiceViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Emergency Services with spatial queries
    
    Provides CRUD operations and spatial query endpoints
    """
    queryset = EmergencyService.objects.all()
    serializer_class = EmergencyServiceSerializer
    
    # Custom renderer classes for styled API
    renderer_classes = [JSONRenderer, BrowsableAPIRenderer]
    
    def get_template_names(self):
        """Return appropriate template based on action"""
        if self.action == 'list':
            return ['rest_framework/api_list.html']
        elif self.action == 'retrieve':
            return ['rest_framework/api_detail.html']
        elif self.action in ['nearest', 'within_radius', 'by_type', 'statistics']:
            return ['rest_framework/action.html']
        return ['rest_framework/api.html']
    
    def get_queryset(self):
        """Filter queryset by service type if provided"""
        queryset = EmergencyService.objects.all()
        service_type = self.request.query_params.get('type', None)
        
        if service_type:
            queryset = queryset.filter(service_type=service_type)
        
        return queryset
    
    def list(self, request, *args, **kwargs):
        """Override list to return simple format for frontend"""
        queryset = self.get_queryset()
        
        # Simple serialization for frontend
        data = []
        for service in queryset:
            data.append({
                'id': service.id,
                'name': service.name,
                'service_type': service.service_type,
                'address': service.address,
                'phone': service.phone,
                'email': service.email,
                'latitude': service.latitude,
                'longitude': service.longitude,
                'capacity': service.capacity,
                'is_24_hours': service.is_24_hours,
                'description': service.description
            })
        
        return Response(data)
    
    @action(detail=False, methods=['get'])
    def nearest(self, request):
        """
        SPATIAL QUERY 1: Find nearest emergency services to a point
        
        Parameters:
        - lat: latitude
        - lng: longitude
        - limit: number of results (default: 5)
        - type: filter by service type (optional)
        
        Example: /api/services/nearest/?lat=53.3498&lng=-6.2603&limit=5&type=hospital
        """
        try:
            lat = float(request.query_params.get('lat'))
            lng = float(request.query_params.get('lng'))
            limit = int(request.query_params.get('limit', 5))
            service_type = request.query_params.get('type', None)
        except (TypeError, ValueError):
            return Response(
                {'error': 'Invalid parameters. Provide lat, lng as numbers.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create point from coordinates
        user_location = Point(lng, lat, srid=4326)
        
        # Query with distance calculation and ordering
        queryset = EmergencyService.objects.annotate(
            distance=Distance('location', user_location)
        ).order_by('distance')[:limit]
        
        # Apply service type filter if provided
        if service_type:
            queryset = queryset.filter(service_type=service_type)
        
        # Serialize manually
        data = []
        for service in queryset:
            data.append({
                'id': service.id,
                'name': service.name,
                'service_type': service.service_type,
                'address': service.address,
                'phone': service.phone,
                'latitude': service.latitude,
                'longitude': service.longitude,
                'is_24_hours': service.is_24_hours,
                'distance': {
                    'm': float(service.distance.m),
                    'km': round(service.distance.m / 1000, 2)
                }
            })
        
        return Response({
            'user_location': {'lat': lat, 'lng': lng},
            'count': len(data),
            'services': data
        })
    
    @action(detail=False, methods=['get'])
    def within_radius(self, request):
        """
        SPATIAL QUERY 2: Find all services within a radius
        
        Parameters:
        - lat: latitude
        - lng: longitude
        - radius: radius in kilometers (default: 5)
        - type: filter by service type (optional)
        
        Example: /api/services/within_radius/?lat=53.3498&lng=-6.2603&radius=10
        """
        try:
            lat = float(request.query_params.get('lat'))
            lng = float(request.query_params.get('lng'))
            radius = float(request.query_params.get('radius', 5))
            service_type = request.query_params.get('type', None)
        except (TypeError, ValueError):
            return Response(
                {'error': 'Invalid parameters. Provide lat, lng, radius as numbers.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create point from coordinates
        user_location = Point(lng, lat, srid=4326)
        
        # Query services within radius using DWithin
        queryset = EmergencyService.objects.filter(
            location__dwithin=(user_location, D(km=radius))
        ).annotate(
            distance=Distance('location', user_location)
        ).order_by('distance')
        
        # Apply service type filter if provided
        if service_type:
            queryset = queryset.filter(service_type=service_type)
        
        # Serialize manually
        data = []
        for service in queryset:
            data.append({
                'id': service.id,
                'name': service.name,
                'service_type': service.service_type,
                'address': service.address,
                'phone': service.phone,
                'latitude': service.latitude,
                'longitude': service.longitude,
                'is_24_hours': service.is_24_hours,
                'distance': {
                    'm': float(service.distance.m),
                    'km': round(service.distance.m / 1000, 2)
                }
            })
        
        return Response({
            'user_location': {'lat': lat, 'lng': lng},
            'radius_km': radius,
            'count': len(data),
            'services': data
        })
    
    @action(detail=False, methods=['get'])
    def by_type(self, request):
        """
        SPATIAL QUERY 3: Get services by type with distance from point
        
        Parameters:
        - lat: latitude
        - lng: longitude
        - type: service type (hospital, police, fire)
        
        Example: /api/services/by_type/?lat=53.3498&lng=-6.2603&type=hospital
        """
        try:
            lat = float(request.query_params.get('lat'))
            lng = float(request.query_params.get('lng'))
            service_type = request.query_params.get('type')
        except (TypeError, ValueError):
            return Response(
                {'error': 'Invalid parameters. Provide lat, lng as numbers and type.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if service_type not in ['hospital', 'police', 'fire']:
            return Response(
                {'error': 'Invalid service type. Choose: hospital, police, or fire.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create point from coordinates
        user_location = Point(lng, lat, srid=4326)
        
        # Query by type with distance
        queryset = EmergencyService.objects.filter(
            service_type=service_type
        ).annotate(
            distance=Distance('location', user_location)
        ).order_by('distance')
        
        # Serialize manually
        data = []
        for service in queryset:
            data.append({
                'id': service.id,
                'name': service.name,
                'service_type': service.service_type,
                'address': service.address,
                'phone': service.phone,
                'latitude': service.latitude,
                'longitude': service.longitude,
                'is_24_hours': service.is_24_hours,
                'distance': {
                    'm': float(service.distance.m),
                    'km': round(service.distance.m / 1000, 2)
                }
            })
        
        return Response({
            'user_location': {'lat': lat, 'lng': lng},
            'service_type': service_type,
            'count': len(data),
            'services': data
        })
    
    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """Get statistics about emergency services"""
        total = EmergencyService.objects.count()
        hospitals = EmergencyService.objects.filter(service_type='hospital').count()
        police = EmergencyService.objects.filter(service_type='police').count()
        fire = EmergencyService.objects.filter(service_type='fire').count()
        available_24h = EmergencyService.objects.filter(is_24_hours=True).count()
        
        return Response({
            'total_services': total,
            'by_type': {
                'hospitals': hospitals,
                'police_stations': police,
                'fire_stations': fire
            },
            'available_24_hours': available_24h
        })