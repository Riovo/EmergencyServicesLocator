from django.contrib.gis.db import models
from django.contrib.gis.geos import Point


# Model representing an emergency service location (hospital, police, fire station)
class EmergencyService(models.Model):
    """Model for emergency service locations with spatial data"""
    
    # Available service types
    SERVICE_TYPES = [
        ('hospital', 'Hospital'),
        ('police', 'Police Station'),
        ('fire', 'Fire Station'),
    ]
    
    # Basic information fields
    name = models.CharField(max_length=200) # Service name
    service_type = models.CharField(max_length=20, choices=SERVICE_TYPES) # Type of service
    address = models.CharField(max_length=300) # Full address
    phone = models.CharField(max_length=20, blank=True) # Contact phone number
    email = models.EmailField(blank=True) # Contact email
    
    # Spatial field using PostGIS PointField
    # SRID 4326 = WGS84 coordinate system (standard lat/lng)
    location = models.PointField(srid=4326)
    
    # Additional service details
    capacity = models.IntegerField(default=0, help_text="Bed capacity for hospitals") # Number of beds/seats
    is_24_hours = models.BooleanField(default=True) # Whether service operates 24/7
    description = models.TextField(blank=True) # Additional description
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True) # Set when record is created
    updated_at = models.DateTimeField(auto_now=True) # Updated on every save
    
    class Meta:
        ordering = ['name'] # Order by name alphabetically
        indexes = [
            models.Index(fields=['service_type']), # Index for faster filtering by type
        ]
    
    def __str__(self):
        return f"{self.name} ({self.get_service_type_display()})"
    
    # Property to get latitude from Point field
    @property
    def latitude(self):
        """Return latitude from Point"""
        return self.location.y if self.location else None
    
    # Property to get longitude from Point field
    @property
    def longitude(self):
        """Return longitude from Point"""
        return self.location.x if self.location else None