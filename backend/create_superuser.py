import os
import django

# Set Django settings module before importing Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'emergency_project.settings')
django.setup()

from django.contrib.auth import get_user_model
from decouple import config

# Script to automatically create Django admin superuser
# Runs during Docker container startup to ensure admin access
User = get_user_model()

# Get admin credentials from environment variables or use defaults
# Defaults are for development only - change in production
admin_username = config('ADMIN_USERNAME', default='admin')
admin_email = config('ADMIN_EMAIL', default='admin@example.com')
admin_password = config('ADMIN_PASSWORD', default='admin123')

# Create superuser if it doesn't already exist
if not User.objects.filter(username=admin_username).exists():
    User.objects.create_superuser(admin_username, admin_email, admin_password)
    print(f"✅ Superuser created: {admin_username}")
else:
    print(f"✅ Superuser already exists: {admin_username}")