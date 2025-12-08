import os
from django.core.wsgi import get_wsgi_application

# WSGI configuration for production deployment
# WSGI (Web Server Gateway Interface) is the standard interface between web servers and Python web applications
# Used by Gunicorn and other WSGI servers in production

# Set Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'emergency_project.settings')

# Create WSGI application object
# This is what the web server (Gunicorn) calls to handle requests
application = get_wsgi_application()