import os
import sys
import django
from django.core.management import call_command
from django.core.wsgi import get_wsgi_application
from waitress import serve

def main():
    # 1. Tell Python where your settings are
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

    # 2. Initialize Django 
    django.setup()

    # 3. Auto-Migrate the Database
    print("Checking and applying database migrations...")
    try:
        call_command('migrate', interactive=False)
        print("Database is ready!")
    except Exception as e:
        print(f"Error setting up the database: {e}")

    # 4. Get the WSGI application
    application = get_wsgi_application()

    # 5. Start the Waitress Server
    port = 8000
    print(f"Starting Waitress server on http://127.0.0.1:{port}...")
    
    # Waitress will quietly and efficiently serve your app
    serve(application, host='127.0.0.1', port=port)


if __name__ == '__main__':
    main()