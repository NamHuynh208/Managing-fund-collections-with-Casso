from django.contrib.auth.views import LogoutView
from django.urls import path
from . import views

app_name = "accounts"
urlpatterns = [
    path("login/", views.login_request, name="login"),
    path("login/code/", views.login_code, name="code"),
    path("login/verify/", views.verify_link, name="verify"),
    path("logout/", LogoutView.as_view(), name="logout"),   # chỉ nhận POST
]