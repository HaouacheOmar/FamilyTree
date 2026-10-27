from pathlib import Path

from corsheaders.defaults import default_headers
import os
import sys

# 1. BASE DIRECTORY LOGIC
# BASE_DIR is where the code/executable lives.
BASE_DIR = Path(__file__).resolve().parent.parent

# 2. DETECT IF RUNNING AS .EXE (PyInstaller)
IS_FROZEN = getattr(sys, 'frozen', False)

# Optional override for portable mode (e.g., USB key)
EXTERNAL_DATA_DIR = os.environ.get('FAMILYTREE_DATA_DIR')

if EXTERNAL_DATA_DIR:
    DATA_DIR = Path(EXTERNAL_DATA_DIR)
elif IS_FROZEN:
    # Production: Store data in C:\Users\Name\AppData\Local\FamilyTree
    # This ensures the app can write to the database without Admin rights.
    DATA_DIR = Path(os.environ['LOCALAPPDATA']) / 'FamilyTree'
else:
    # Development: Store data in the project folder
    DATA_DIR = BASE_DIR

# Create the data directory and media folder if they don't exist
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(DATA_DIR / 'media', exist_ok=True)

# 3. CORE SETTINGS
# Defaults suit the desktop app (local only). The Docker image overrides them through the environment.
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'django-insecure-8f*+h2y#v(l_x$9z!c)m^w%q@k&p=t3j7b')
DEBUG = os.environ.get('DJANGO_DEBUG', '1') == '1'
# Refusing other Host headers blocks DNS-rebinding attacks; a hosted install lists its own domain here.
ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', '127.0.0.1,localhost').split(',')
# Set by Electron on every launch, or by the Docker host once; see familyTree/middleware.py.
API_TOKEN = os.environ.get('FAMILYTREE_API_TOKEN')
# Built React app (familytree_front/dist). When set, Django serves the UI at "/" (Docker image).
FRONTEND_DIR = Path(os.environ['FAMILYTREE_FRONTEND_DIR']) if os.environ.get('FAMILYTREE_FRONTEND_DIR') else None

# 4. APPS & MIDDLEWARE
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'familyTree',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'familyTree.middleware.ApiTokenMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# 5. DATABASE CONFIGURATION (Points to AppData in Production)
def _database_from_url(url):
    """postgres://user:pass@host:port/name?sslmode=require (e.g. Neon) -> a Django DATABASES entry."""
    from urllib.parse import parse_qsl, unquote, urlsplit
    parts = urlsplit(url)
    return {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': unquote(parts.path.lstrip('/')),
        'USER': unquote(parts.username or ''),
        'PASSWORD': unquote(parts.password or ''),
        'HOST': parts.hostname or '',
        'PORT': str(parts.port or ''),
        'OPTIONS': dict(parse_qsl(parts.query)),  # sslmode, channel_binding, ...
        'CONN_MAX_AGE': 60,
        'CONN_HEALTH_CHECKS': True,
    }


# Hosted (Render + Neon) sets DATABASE_URL; the desktop app and Docker image use SQLite in DATA_DIR.
DATABASES = {
    'default': _database_from_url(os.environ['DATABASE_URL']) if os.environ.get('DATABASE_URL') else {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': DATA_DIR / 'db.sqlite3',
    }
}

AUTH_PASSWORD_VALIDATORS = []

# 6. INTERNATIONALIZATION
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_L10N = True
USE_TZ = True

# 7. STATIC & MEDIA FILES
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Media (Photos) must be in the writable DATA_DIR
MEDIA_URL = '/media/'
MEDIA_ROOT = DATA_DIR / 'media'

# 8. CORS CONFIGURATION
# Desktop/Docker: any origin (the API token authorizes callers). Hosted: list the frontend origin(s), comma-separated.
CORS_ALLOWED_ORIGINS = [o for o in os.environ.get('FAMILYTREE_CORS_ORIGINS', '').split(',') if o]
CORS_ALLOW_ALL_ORIGINS = not CORS_ALLOWED_ORIGINS
CORS_ALLOW_HEADERS = (*default_headers, 'x-familytree-token')
CORS_EXPOSE_HEADERS = ['X-Total-Count']  # lets the UI say "showing N of M"