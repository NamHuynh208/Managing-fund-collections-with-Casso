from django.contrib import admin
from .models import AuditLog, Expense, FeePeriod, Invoice


@admin.register(FeePeriod)
class FeePeriodAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "amount", "due_date", "created_at")
    ordering = ("-due_date", "-id")


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ("id", "member", "period", "amount", "status", "paid_at")
    list_filter = ("status", "period")
    search_fields = ("member__full_name", "member__email")
    ordering = ("-id",)


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ("id", "spent_at", "reason", "amount", "created_by")
    ordering = ("-spent_at", "-id")


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "user", "action", "detail")
    list_filter = ("action",)
    readonly_fields = [f.name for f in AuditLog._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False