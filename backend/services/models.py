from django.contrib.gis.db import models
from django.contrib.gis.geos import Point


class EmergencyService(models.Model):
    """Model for emergency service locations with spatial data"""
    
    SERVICE_TYPES = [
        ('hospital', 'Hospital'),
        ('police', 'Police Station'),
        ('fire', 'Fire Station'),
    ]
    
    name = models.CharField(max_length=200)
    service_type = models.CharField(max_length=20, choices=SERVICE_TYPES)
    address = models.CharField(max_length=300)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    
    # Spatial field - This is the key PostGIS feature
    location = models.PointField(srid=4326)  # WGS84 coordinate system
    
    # Additional fields
    capacity = models.IntegerField(default=0, help_text="Bed capacity for hospitals")
    is_24_hours = models.BooleanField(default=True)
    description = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['name']
        indexes = [
            models.Index(fields=['service_type']),
        ]
    
    def __str__(self):
        return f"{self.name} ({self.get_service_type_display()})"
    
    @property
    def latitude(self):
        """Return latitude from Point"""
        return self.location.y if self.location else None
    
    @property
    def longitude(self):
        """Return longitude from Point"""
        return self.location.x if self.location else None