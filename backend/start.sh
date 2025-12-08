#!/bin/bash
# Exit immediately if any command fails
set -e

echo "🚀 Starting Emergency Services Locator..."

# Wait for PostgreSQL database to be ready before starting Django
# This prevents connection errors during container startup
echo "⏳ Waiting for database..."
echo "Connecting to: ${DATABASE_HOST}:${DATABASE_PORT}/${DATABASE_NAME} as ${DATABASE_USER}"
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
  if python -c "import psycopg2; psycopg2.connect(host='${DATABASE_HOST}', port='${DATABASE_PORT}', user='${DATABASE_USER}', password='${DATABASE_PASSWORD}', dbname='${DATABASE_NAME}')" 2>/dev/null; then
    echo "✅ Database is ready!"
    break
  fi
  attempt=$((attempt + 1))
  echo "Database not ready, waiting... (attempt $attempt/$max_attempts)"
  sleep 2
done

if [ $attempt -eq $max_attempts ]; then
  echo "❌ Database connection failed after $max_attempts attempts"
  echo "Please check your DATABASE_* environment variables"
  exit 1
fi

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
# Listen on all interfaces, port 8000
# Number of worker processes
# Request timeout in seconds
# Log access to stdout
# Log errors to stderr
echo "🌟 Starting Gunicorn server..."
exec gunicorn emergency_project.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers 3 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile - \
    --log-level info

