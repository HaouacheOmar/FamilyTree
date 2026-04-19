from rest_framework import routers
from django.urls import path, include
from .views import PersonMediaViewSet, PersonViewSet, RelationshipViewSet
from . import views

router = routers.DefaultRouter()
router.register(r'people', PersonViewSet, basename='person')
router.register(r'relationships', RelationshipViewSet, basename='relationship')
router.register(r'media', PersonMediaViewSet, basename='media')

urlpatterns = [
    path('api/', include(router.urls)),
    path('api/export/', views.export_tree, name='export_tree'),
    path('api/import/', views.import_tree, name='import_tree'),
    path('api/export-gedcom/', views.export_gedcom, name='export_gedcom'),
    path('api/import-gedcom/', views.import_gedcom, name='import_gedcom'),
    path('api/stats/', views.stats, name='stats'),
    path('api/timeline/', views.timeline, name='timeline'),
    path('', views.dashboard, name='dashboard'),
] 