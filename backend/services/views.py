from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from rest_framework.renderers import JSONRenderer, BrowsableAPIRenderer
from django.contrib.gis.geos import Point
from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.measure import D
from decouple import config
import requests
import logging
from .models import EmergencyService
from .serializers import EmergencyServiceSerializer

logger = logging.getLogger(__name__)


# ViewSet for EmergencyService model - handles all CRUD operations via REST API
class EmergencyServiceViewSet(viewsets.ModelViewSet):
    queryset = EmergencyService.objects.all()
    serializer_class = EmergencyServiceSerializer
    renderer_classes = [JSONRenderer, BrowsableAPIRenderer] # JSON and browsable API
    
    # Set template names for different actions in browsable API
    def get_template_names(self):
        if self.action == 'list':
            return ['rest_framework/api_list.html']
        elif self.action == 'retrieve':
            return ['rest_framework/api_detail.html']
        elif self.action in ['nearest', 'within_radius', 'by_type', 'statistics']:
            return ['rest_framework/action.html']
        return ['rest_framework/api.html']
    
    # Filter queryset by service type if 'type' parameter is provided
    def get_queryset(self):
        queryset = EmergencyService.objects.all()
        service_type = self.request.query_params.get('type', None)
        if service_type:
            queryset = queryset.filter(service_type=service_type)
        return queryset
    
    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
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
    
    # Custom action: Find nearest N services to given coordinates
    # Uses PostGIS ST_Distance function to calculate distances
    @action(detail=False, methods=['get'])
    def nearest(self, request):
        try:
            # Get parameters from query string
            lat = float(request.query_params.get('lat'))
            lng = float(request.query_params.get('lng'))
            limit = int(request.query_params.get('limit', 5)) # Default to 5 if not specified
            service_type = request.query_params.get('type', None)
        except (TypeError, ValueError) as e:
            logger.warning(f'Invalid parameters: {e}')
            return Response(
                {'error': 'Invalid parameters. Provide lat, lng as numbers.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create Point object from user coordinates (SRID 4326 = WGS84)
        user_location = Point(lng, lat, srid=4326)
        # Annotate each service with distance from user location using PostGIS Distance function
        # Order by distance ascending and limit to N results
        queryset = EmergencyService.objects.annotate(
            distance=Distance('location', user_location)
        ).order_by('distance')[:limit]
        
        # Filter by service type if specified
        if service_type:
            queryset = queryset.filter(service_type=service_type)
        
        # Build response data with distance in both meters and kilometers
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
    
    # Custom action: Find all services within specified radius
    # Uses PostGIS ST_DWithin function for efficient spatial query
    @action(detail=False, methods=['get'])
    def within_radius(self, request):
        try:
            # Get parameters from query string
            lat = float(request.query_params.get('lat'))
            lng = float(request.query_params.get('lng'))
            radius = float(request.query_params.get('radius', 5)) # Default 5km
            service_type = request.query_params.get('type', None)
        except (TypeError, ValueError) as e:
            logger.warning(f'Invalid parameters: {e}')
            return Response(
                {'error': 'Invalid parameters. Provide lat, lng, radius as numbers.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create Point object from user coordinates
        user_location = Point(lng, lat, srid=4326)
        # Use PostGIS ST_DWithin to find all points within radius
        # D(km=radius) creates a distance object in kilometers
        queryset = EmergencyService.objects.filter(
            location__dwithin=(user_location, D(km=radius))
        ).annotate(
            distance=Distance('location', user_location)
        ).order_by('distance')
        
        # Filter by service type if specified
        if service_type:
            queryset = queryset.filter(service_type=service_type)
        
        # Build response data
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
        try:
            lat = float(request.query_params.get('lat'))
            lng = float(request.query_params.get('lng'))
            service_type = request.query_params.get('type')
        except (TypeError, ValueError) as e:
            logger.warning(f'Invalid parameters: {e}')
            return Response(
                {'error': 'Invalid parameters. Provide lat, lng as numbers and type.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if service_type not in ['hospital', 'police', 'fire']:
            return Response(
                {'error': 'Invalid service type. Choose: hospital, police, or fire.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user_location = Point(lng, lat, srid=4326)
        queryset = EmergencyService.objects.filter(
            service_type=service_type
        ).annotate(
            distance=Distance('location', user_location)
        ).order_by('distance')
        
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


# API endpoint to convert address/street name to coordinates (geocoding)
@api_view(['GET'])
def geocode_address(request):
    query = request.query_params.get('query', '').strip()
    
    # Validate query parameter
    if not query:
        return Response(
            {'error': 'Query parameter is required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Get API key from environment variable (never hardcode in source code)
    api_key = config('OPENCAGE_API_KEY', default='')
    
    # Try OpenCage API first if key is available
    if api_key and api_key.strip() != '':
        try:
            url = "https://api.opencagedata.com/geocode/v1/json"
            params = {
                'q': f"{query}, Ireland",
                'key': api_key,
                'countrycode': 'ie',
                'limit': 1,
                'no_annotations': 1
            }
            
            response = requests.get(url, params=params, timeout=5)
            response.raise_for_status()
            data = response.json()
            
            if data.get('results') and len(data['results']) > 0:
                result = data['results'][0]
                geometry = result['geometry']
                components = result.get('components', {})
                formatted = result.get('formatted', query)
                confidence = result.get('confidence', 0) / 10
                
                lat = geometry['lat']
                lng = geometry['lng']
                
                if not (51.4 <= lat <= 55.4 and -10.5 <= lng <= -5.5):
                    raise ValueError("Coordinates outside Ireland bounds")
                
                address_parts = []
                if components.get('house_number'):
                    address_parts.append(components['house_number'])
                if components.get('road'):
                    address_parts.append(components['road'])
                if components.get('suburb'):
                    address_parts.append(components['suburb'])
                if components.get('city') or components.get('town'):
                    address_parts.append(components.get('city') or components.get('town'))
                
                formatted_address = ', '.join(address_parts) if address_parts else formatted
                
                return Response({
                    'lat': lat,
                    'lng': lng,
                    'formatted_address': formatted_address,
                    'confidence': confidence,
                    'source': 'opencage'
                })
                
        except Exception as e:
            logger.warning(f'OpenCage error, falling back to Nominatim: {e}')
    
    try:
        url = "https://nominatim.openstreetmap.org/search"
        params = {
            'q': f"{query}, Ireland",
            'format': 'json',
            'limit': 1,
            'addressdetails': 1,
            'countrycodes': 'ie'
        }
        headers = {'User-Agent': 'EmergencyServicesLocator/1.0'}
        
        response = requests.get(url, params=params, headers=headers, timeout=5)
        response.raise_for_status()
        data = response.json()
        
        if data and len(data) > 0:
            result = data[0]
            lat = float(result['lat'])
            lng = float(result['lon'])
            
            if 51.4 <= lat <= 55.4 and -10.5 <= lng <= -5.5:
                address_parts = []
                if result.get('address'):
                    addr = result['address']
                    if addr.get('house_number'):
                        address_parts.append(addr['house_number'])
                    if addr.get('road'):
                        address_parts.append(addr['road'])
                    if addr.get('suburb'):
                        address_parts.append(addr['suburb'])
                    if addr.get('city') or addr.get('town'):
                        address_parts.append(addr.get('city') or addr.get('town'))
                
                formatted_address = ', '.join(address_parts) if address_parts else result.get('display_name', query)
                
                return Response({
                    'lat': lat,
                    'lng': lng,
                    'formatted_address': formatted_address,
                    'confidence': 8,
                    'source': 'nominatim'
                })
    except Exception as e:
        logger.error(f'Geocoding failed: {e}')
        return Response(
            {'error': f'Geocoding failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    return Response(
        {'error': 'No results found. Please try a different address.'},
        status=status.HTTP_404_NOT_FOUND
    )