# -*- mode: python ; coding: utf-8 -*-

a = Analysis(
    ['serve.py'],
    pathex=[],
    binaries=[],
    datas=[
        # Include your Django templates
        ('familyTree/templates', 'familyTree/templates'),
    ],
    hiddenimports=[
        # Core Django
        'config.settings',
        'config.urls',
        'config.wsgi',
        'django.core.management',
        'django.core.wsgi',
        'django.db.backends.sqlite3',
        
        # Installed Apps
        'django.contrib.admin',
        'django.contrib.auth',
        'django.contrib.contenttypes',
        'django.contrib.sessions',
        'django.contrib.messages',
        'django.contrib.staticfiles',
        
        # Third-party Apps
        'rest_framework',
        'corsheaders',
        'waitress',
        
        # Your App modules
        'familyTree',
        'familyTree.apps',
        'familyTree.models',
        'familyTree.urls',
        'familyTree.views',
        'familyTree.serializers',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='familytree_backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,  # CRITICAL: Set to False to hide the ugly black CMD window
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)