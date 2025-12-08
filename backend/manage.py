#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys


# Main entry point for Django management commands
# Used for commands like: python manage.py migrate, python manage.py runserver, etc.
def main():
    """Run administrative tasks."""
    # Set Django settings module before importing Django
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'emergency_project.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        # Error if Django is not installed or virtual environment not activated
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    # Execute the command passed as command-line arguments
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()