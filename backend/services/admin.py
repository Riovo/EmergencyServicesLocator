from django.contrib.gis import admin
from .models import EmergencyService


@admin.register(EmergencyService)
class EmergencyServiceAdmin(admin.GISModelAdmin):
    """Admin interface with map widget for spatial data"""
    
    list_display = ['name', 'service_type', 'address', 'phone', 'is_24_hours']
    list_filter = ['service_type', 'is_24_hours']
    search_fields = ['name', 'address']
    
    # GIS-specific settings
    gis_widget_kwargs = {
        'attrs': {
            'default_zoom': 12,
        },
    }