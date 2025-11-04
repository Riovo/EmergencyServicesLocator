from rest_framework import serializers
from rest_framework_gis.serializers import GeoFeatureModelSerializer
from .models import EmergencyService


class EmergencyServiceSerializer(GeoFeatureModelSerializer):
    """Serializer for EmergencyService with GeoJSON support"""
    
    latitude = serializers.FloatField(read_only=True)
    longitude = serializers.FloatField(read_only=True)
    
    class Meta:
        model = EmergencyService
        geo_field = 'location'
        fields = [
            'id', 'name', 'service_type', 'address', 'phone', 
            'email', 'capacity', 'is_24_hours', 'description',
            'latitude', 'longitude', 'created_at', 'updated_at'
        ]


class EmergencyServiceListSerializer(serializers.ModelSerializer):
    """Simplified serializer for list views"""
    
    latitude = serializers.FloatField(read_only=True)
    longitude = serializers.FloatField(read_only=True)
    distance = serializers.SerializerMethodField()
    
    class Meta:
        model = EmergencyService
        fields = [
            'id', 'name', 'service_type', 'address', 'phone',
            'latitude', 'longitude', 'is_24_hours', 'distance'
        ]
    
    def get_distance(self, obj):
        """Get distance in meters if available"""
        if hasattr(obj, 'distance') and obj.distance:
            return {'m': float(obj.distance.m), 'km': round(obj.distance.m / 1000, 2)}
        return None