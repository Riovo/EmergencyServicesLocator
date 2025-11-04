from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import EmergencyServiceViewSet

router = DefaultRouter()
router.register(r'services', EmergencyServiceViewSet, basename='service')

urlpatterns = [
    path('', include(router.urls)),
]