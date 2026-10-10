from django.contrib import admin
from django.db import connection
from django.http import JsonResponse
from django.urls import path
from apps.api.api import api

def health(request):
    try:
        with connection.cursor() as c:
            c.execute("SELECT 1")
        return JsonResponse({
            "status": "ok",
            "db": "connected",
        })
    except Exception:
        return JsonResponse({
            "status": "error",
            "db": "down",
        }, status=500)


urlpatterns = [
    path("health", health),
    path("admin/", admin.site.urls),
    path("api/", api.urls),
]
