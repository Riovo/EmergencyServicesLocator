from django.contrib.gis import admin
from .models import EmergencyService


# Admin interface configuration for EmergencyService model
# Uses GeoDjango's GISModelAdmin to show interactive map widget
@admin.register(EmergencyService)
class EmergencyServiceAdmin(admin.GISModelAdmin):
    # Fields to display in the list view
    list_display = ['name', 'service_type', 'address', 'phone', 'is_24_hours', 'get_location']
    # Filters shown in sidebar
    list_filter = ['service_type', 'is_24_hours']
    # Fields searchable in admin
    search_fields = ['name', 'address', 'phone']
    # Fields that cannot be edited (auto-generated)
    readonly_fields = ['created_at', 'updated_at']
    
    # Organize form fields into sections
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'service_type', 'address', 'phone', 'email', 'description')
        }),
        ('Location', {
            'fields': ('location',), # GeoDjango map widget appears here
        }),
        ('Service Details', {
            'fields': ('capacity', 'is_24_hours')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',) # Collapsed by default
        }),
    )
    
    # Default map center (Dublin city center)
    default_lat = 53.3498
    default_lon = -6.2603
    default_zoom = 12
    
    # Custom method to display coordinates in list view
    def get_location(self, obj):
        if obj.location:
            return f"Lat: {obj.latitude:.4f}, Lng: {obj.longitude:.4f}"
        return "No location set"
    get_location.short_description = "Coordinates"