from django import forms
from django.contrib import messages
from django.contrib.auth import login
from django.shortcuts import redirect, render
from django.views.decorators.http import require_http_methods
from .models import User
from . import services


class EmailForm(forms.Form):
    email = forms.EmailField(label="Email")


@require_http_methods(["GET", "POST"])
def login_request(request):
    if request.user.is_authenticated:
        return redirect("funds:home")
    form = EmailForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        email = form.cleaned_data["email"]
        if not services.hit_limit(f"login-ip:{services.client_ip(request)}", 10, 600):
            services.issue_login(email, request)
        request.session["login_email"] = email
        messages.info(request, "Nếu email có trong danh sách CLB, bạn sẽ nhận được thư đăng nhập.")
        return redirect("accounts:code")
    return render(request, "accounts/login.html", {"form": form})


@require_http_methods(["GET", "POST"])
def login_code(request):
    email = request.session.get("login_email")
    if not email:
        return redirect("accounts:login")
    if request.method == "POST":
        user = User.objects.filter(email__iexact=email, is_active=True).first()
        lt = services.check_code(user, request.POST.get("code", "").strip()) if user else None
        if lt and services.consume(lt):
            login(request, lt.user)
            return redirect("funds:home")
        messages.error(request, "Mã không đúng hoặc đã hết hạn.")
    return render(request, "accounts/code.html", {"email": email})


@require_http_methods(["GET", "POST"])
def verify_link(request):
    token = request.GET.get("token") or request.POST.get("token", "")
    if request.method == "POST":
        lt = services.find_by_token(token)
        if lt and services.consume(lt):
            login(request, lt.user)
            return redirect("funds:home")
        messages.error(request, "Liên kết không hợp lệ hoặc đã hết hạn. Hãy yêu cầu lại.")
        return redirect("accounts:login")
    return render(request, "accounts/confirm.html", {"token": token})