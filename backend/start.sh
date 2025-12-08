#!/bin/bash
# Exit immediately if any command fails
set -e

echo "🚀 Starting Emergency Services Locator..."

# Wait for PostgreSQL database to be ready before starting Django
# This prevents connection errors during container startup
echo "⏳ Waiting for database..."
while ! python -c "import psycopg2; psycopg2.connect(host='${DATABASE_HOST}', port='${DATABASE_PORT}', user='${DATABASE_USER}', password='${DATABASE_PASSWORD}', dbname='${DATABASE_NAME}')" 2>/dev/null; do
  echo "Database not ready, waiting..."
  sleep 2
done

echo "✅ Database is ready!"

# Apply database migrations to update schema
echo "📦 Running database migrations..."
python manage.py migrate --noinput

# Load initial emergency services data if database is empty
# Checks if any EmergencyService records exist
if [ "$(python manage.py shell -c "from services.models import EmergencyService; print(EmergencyService.objects.count())")" = "0" ]; then
    echo "📥 Loading initial data..."
    python manage.py loaddata services/fixtures/initial_data.json || true
fi

# Create Django admin superuser automatically
echo "👤 Creating superuser..."
python create_superuser.py || true

# Collect all static files into STATIC_ROOT directory
# Required for serving static files in production
echo "📁 Collecting static files..."
python manage.py collectstatic --noinput || true

# Start Gunicorn WSGI server for production
echo "🌟 Starting Gunicorn server..."
exec gunicorn emergency_project.wsgi:application \
    --bind 0.0.0.0:8000 \ # Listen on all interfaces, port 8000
    --workers 3 \ # Number of worker processes
    --timeout 120 \ # Request timeout in seconds
    --access-logfile - \ # Log access to stdout
    --error-logfile - \ # Log errors to stderr
    --log-level info # Logging level

