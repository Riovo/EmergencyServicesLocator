import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'emergency_project.settings')
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()

if not User.objects.filter(username='C22375093').exists():
    User.objects.create_superuser('C22375093', 'C22375093@mytudublin.ie', 'C22375093')
    print("✅ Superuser created: C22375093/C22375093")
else:
    print("✅ Superuser already exists: C22375093")