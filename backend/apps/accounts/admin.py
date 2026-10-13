from django import forms
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


class MemberCreationForm(forms.ModelForm):
    class Meta:
        model = User
        fields = ("email", "full_name", "role")

    def save(self, commit=True):
        user = super().save(commit=False)
        user.set_unusable_password()   # thành viên chỉ đăng nhập bằng magic link
        if commit:
            user.save()
        return user


@admin.register(User)
class MemberAdmin(UserAdmin):
    add_form = MemberCreationForm
    ordering = ("full_name",)
    list_display = ("full_name", "email", "role", "transfer_code", "is_active")
    search_fields = ("full_name", "email", "transfer_code")
    readonly_fields = ("transfer_code",)
    fieldsets = (
        (None, {"fields": ("email", "full_name", "role", "is_active", "transfer_code")}),
        ("Quyền admin", {"fields": ("is_staff", "is_superuser")}),
    )
    add_fieldsets = ((None, {"fields": ("email", "full_name", "role")}),)

from .models import RegistrationRequest

@admin.register(RegistrationRequest)
class RegistrationRequestAdmin(admin.ModelAdmin):
    list_display = ("created_at", "full_name", "email", "status")
    list_filter = ("status",)