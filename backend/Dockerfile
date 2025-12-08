# Development Dockerfile - uses Django development server
FROM python:3.11-slim

# Python environment variables
# Don't buffer stdout/stderr
ENV PYTHONUNBUFFERED=1
# Don't create .pyc files
ENV PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Install system dependencies required for GeoDjango
# GDAL and PROJ are needed for spatial data processing
RUN apt-get update && apt-get install -y \
    postgresql-client \
    gdal-bin \
    libgdal-dev \
    python3-gdal \
    binutils \
    libproj-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file and install Python packages
COPY requirements.txt /app/
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . /app/

# Collect static files during build
RUN python manage.py collectstatic --noinput || true

# Expose port 8000 for Django development server
EXPOSE 8000

# Start Django development server
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]