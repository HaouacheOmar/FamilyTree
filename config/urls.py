from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.static import serve

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('familyTree.urls')),
]

if settings.FRONTEND_DIR:
    # Hosted (Docker): one process serves the UI, its assets and uploaded photos.
    # ponytail: Django file serving is fine for one family; put nginx or whitenoise in front if traffic grows.
    urlpatterns = [
        path('', serve, {'path': 'index.html', 'document_root': settings.FRONTEND_DIR}),
        re_path(r'^assets/(?P<path>.*)$', serve, {'document_root': settings.FRONTEND_DIR / 'assets'}),
        re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
    ] + urlpatterns
elif settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
