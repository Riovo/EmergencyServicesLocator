from pathlib import Path
from decouple import config

# Get base directory of the project (parent of settings.py)
BASE_DIR = Path(__file__).resolve().parent.parent

# Django secret key for cryptographic signing
# Loaded from environment variable, with insecure default for development only
SECRET_KEY = config('DJANGO_SECRET_KEY', default='django-insecure-dev-key-change-this')
# Debug mode - shows detailed error pages when True
DEBUG = config('DEBUG', default=True, cast=bool)

# SECURITY: ALLOWED_HOSTS should be restricted in production to your domain
# '*' allows all hosts - only for development
ALLOWED_HOSTS = ['*']

# Django applications installed in this project
INSTALLED_APPS = [
    'colorfield', # Color picker for admin interface
    'admin_interface', # Custom admin theme
    'django.contrib.admin', # Django admin interface
    'django.contrib.auth', # Authentication system
    'django.contrib.contenttypes', # Content type framework
    'django.contrib.sessions', # Session framework
    'django.contrib.messages', # Messaging framework
    'django.contrib.staticfiles', # Static file management
    'django.contrib.gis', # GeoDjango for spatial data
    'rest_framework', # Django REST Framework for API
    'corsheaders', # CORS headers for cross-origin requests
    'services', # Our custom app for emergency services
]

# Middleware classes - process requests/responses in order
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware', # Security enhancements
    'whitenoise.middleware.WhiteNoiseMiddleware', # Serve static files in production
    'corsheaders.middleware.CorsMiddleware', # Handle CORS before other middleware
    'django.contrib.sessions.middleware.SessionMiddleware', # Session management
    'django.middleware.common.CommonMiddleware', # Common operations
    'django.middleware.csrf.CsrfViewMiddleware', # CSRF protection
    'django.contrib.auth.middleware.AuthenticationMiddleware', # User authentication
    'django.contrib.messages.middleware.MessageMiddleware', # Message framework
    'django.middleware.clickjacking.XFrameOptionsMiddleware', # Clickjacking protection
]

# Root URL configuration module
ROOT_URLCONF = 'emergency_project.urls'

# Template configuration
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'], # Custom templates directory
        'APP_DIRS': True, # Look for templates in app directories
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug', # Debug info
                'django.template.context_processors.request', # Request object
                'django.contrib.auth.context_processors.auth', # User object
                'django.contrib.messages.context_processors.messages', # Messages
            ],
        },
    },
]

# WSGI application for production deployment
WSGI_APPLICATION = 'emergency_project.wsgi.application'


# Database configuration - PostgreSQL with PostGIS extension
DATABASES = {
    'default': {
        'ENGINE': 'django.contrib.gis.db.backends.postgis', # PostGIS spatial database
        'NAME': config('DATABASE_NAME', default='emergency_db'),
        'USER': config('DATABASE_USER', default='postgres'),
        'PASSWORD': config('DATABASE_PASSWORD', default='postgres123'),
        'HOST': config('DATABASE_HOST', default='postgis'), # Docker service name
        'PORT': config('DATABASE_PORT', default='5432'),
    }
}

# Password validation rules for user accounts
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'}, # Check similarity to user attributes
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'}, # Minimum length
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'}, # Check against common passwords
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'}, # Check for numeric passwords
]

# Internationalization settings
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True # Enable internationalization
USE_TZ = True # Use timezone-aware datetimes

# Static files configuration
STATIC_URL = '/static/' # URL prefix for static files
STATIC_ROOT = BASE_DIR / 'staticfiles' # Directory where collectstatic puts files
STATICFILES_DIRS = [BASE_DIR / 'static'] # Additional directories to search for static files

# WhiteNoise configuration for serving static files in production
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# Default primary key field type for models
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# CORS settings - allow all origins (for development)
CORS_ALLOW_ALL_ORIGINS = True

# Django REST Framework configuration
REST_FRAMEWORK = {
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer', # JSON response format
        'rest_framework.renderers.BrowsableAPIRenderer', # HTML browsable API
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination', # Page-based pagination
    'PAGE_SIZE': 100 # Items per page
}

# X-Frame-Options header - allow same-origin framing (required for admin-interface)
X_FRAME_OPTIONS = 'SAMEORIGIN'

# Logging configuration
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        # Detailed format with timestamp and module name
        'verbose': {
            'format': '{levelname} {asctime} {module} {message}',
            'style': '{',
        },
        # Simple format with just level and message
        'simple': {
            'format': '{levelname} {message}',
            'style': '{',
        },
    },
    'handlers': {
        # Console handler - outputs to stdout/stderr
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
        # File handler - writes to log file
        'file': {
            'class': 'logging.FileHandler',
            'filename': BASE_DIR / 'logs' / 'django.log',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
    'loggers': {
        # Django framework logger
        'django': {
            'handlers': ['console', 'file'],
            'level': config('DJANGO_LOG_LEVEL', default='INFO'),
            'propagate': False, # Don't propagate to root logger
        },
        # Services app logger
        'services': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}