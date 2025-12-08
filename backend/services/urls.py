from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import EmergencyServiceViewSet, geocode_address

# Create router for ViewSet endpoints
router = DefaultRouter()
# Register ViewSet - creates endpoints like /api/services/, /api/services/{id}/, etc.
router.register(r'services', EmergencyServiceViewSet, basename='service')

# URL patterns for services app
urlpatterns = [
    path('', include(router.urls)), # Include all ViewSet routes
    path('geocode/', geocode_address, name='geocode'), # Geocoding endpoint
]