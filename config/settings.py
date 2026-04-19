from pathlib import Path
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

# 3. CORE SETTINGS (Hardcoded for local use)
SECRET_KEY = 'django-insecure-8f*+h2y#v(l_x$9z!c)m^w%q@k&p=t3j7b'
DEBUG = True  # Keep True if you want to see errors, or False for a cleaner app
ALLOWED_HOSTS = ['*']

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
DATABASES = {
    'default': {
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
CORS_ALLOW_ALL_ORIGINS = True