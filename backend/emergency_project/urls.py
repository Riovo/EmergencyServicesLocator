from django.contrib import admin
from django.urls import path, include
from django.views.generic import TemplateView
from django.conf import settings
from django.conf.urls.static import static

# URL patterns for the project
urlpatterns = [
    path('admin/', admin.site.urls), # Django admin interface
    path('api/', include('services.urls')), # API endpoints from services app
    path('', TemplateView.as_view(template_name='index.html'), name='home'), # Home page
]

# Serve static files directly in development mode
# In production, Nginx handles static files
if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATICFILES_DIRS[0] if settings.STATICFILES_DIRS else None)