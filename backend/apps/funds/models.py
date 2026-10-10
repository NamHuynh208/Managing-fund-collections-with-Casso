from django.conf import settings
from django.db import models
from django.db.models import Q


class FeePeriod(models.Model):
    name = models.CharField("Tên kỳ thu", max_length=120)
    amount = models.PositiveBigIntegerField("Số tiền (VND)")
    due_date = models.DateField("Hạn đóng")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.CheckConstraint(condition=Q(amount__gt=0), name="period_amount_gt_0")]

    def __str__(self):
        return self.name


class Invoice(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Chưa đóng"
        PAID = "paid", "Đã đóng"
        CANCELLED = "cancelled", "Đã hủy"

    member = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="invoices")
    period = models.ForeignKey(FeePeriod, on_delete=models.PROTECT, related_name="invoices")
    amount = models.PositiveBigIntegerField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["member", "period"], name="one_invoice_per_member_period"),
            models.CheckConstraint(condition=Q(amount__gt=0), name="invoice_amount_gt_0"),
        ]


class Expense(models.Model):
    amount = models.PositiveBigIntegerField("Số tiền (VND)")
    reason = models.CharField("Lý do", max_length=255)
    spent_at = models.DateField("Ngày chi")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)


class AuditLog(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    action = models.CharField(max_length=50)
    detail = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)