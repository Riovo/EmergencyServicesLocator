from rest_framework import serializers
from rest_framework_gis.serializers import GeoFeatureModelSerializer
from .models import EmergencyService


# Serializer for EmergencyService with GeoJSON support
# Used for full service details including GeoJSON geometry
class EmergencyServiceSerializer(GeoFeatureModelSerializer):
    # Add latitude/longitude as separate fields for easier frontend access
    latitude = serializers.FloatField(read_only=True)
    longitude = serializers.FloatField(read_only=True)
    
    class Meta:
        model = EmergencyService
        geo_field = 'location' # Point field for GeoJSON output
        fields = [
            'id', 'name', 'service_type', 'address', 'phone', 
            'email', 'capacity', 'is_24_hours', 'description',
            'latitude', 'longitude', 'created_at', 'updated_at'
        ]


# Serializer for list views with distance calculation
# Used when services are returned with calculated distances from user location
class EmergencyServiceListSerializer(serializers.ModelSerializer):
    latitude = serializers.FloatField(read_only=True)
    longitude = serializers.FloatField(read_only=True)
    # Distance field calculated by PostGIS queries
    distance = serializers.SerializerMethodField()
    
    class Meta:
        model = EmergencyService
        fields = [
            'id', 'name', 'service_type', 'address', 'phone',
            'latitude', 'longitude', 'is_24_hours', 'distance'
        ]
    
    # Method to format distance in both meters and kilometers
    def get_distance(self, obj):
        if hasattr(obj, 'distance') and obj.distance:
            return {'m': float(obj.distance.m), 'km': round(obj.distance.m / 1000, 2)}
        return None