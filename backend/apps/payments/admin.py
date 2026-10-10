from django.contrib import admin
from .models import BankTransaction


@admin.register(BankTransaction)
class BankTransactionAdmin(admin.ModelAdmin):
    list_display = ("occurred_at", "amount", "content", "status", "member", "source")
    list_filter = ("status", "source")
    search_fields = ("content", "dedupe_key")
    readonly_fields = [f.name for f in BankTransaction._meta.fields]
    def has_add_permission(self, request): return False
    def has_delete_permission(self, request, obj=None): return False