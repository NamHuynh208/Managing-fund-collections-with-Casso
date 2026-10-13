from django.conf import settings
from django.db import models
from django.db.models import Q


class BankTransaction(models.Model):
    class Source(models.TextChoices):
        EMAIL = "email", "Email biến động"
        STATEMENT = "statement", "Sao kê"
        MANUAL = "manual", "Thủ công / tiền mặt"
        CASSO = "casso", "Casso"

    class Status(models.TextChoices):
        MATCHED = "matched", "Đã khớp"
        REVIEW = "review", "Cần xem"
        UNMATCHED = "unmatched", "Chưa khớp"
        IGNORED = "ignored", "Bỏ qua"

    # Mã giao dịch của ngân hàng nếu có, không thì dấu vân tay (xem services). Unique để chống ghi trùng
    dedupe_key = models.CharField(max_length=64, unique=True)
    amount = models.PositiveBigIntegerField()
    content = models.CharField(max_length=500, blank=True)
    occurred_at = models.DateTimeField()
    source = models.CharField(max_length=10, choices=Source.choices)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.UNMATCHED)
    member = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                               on_delete=models.SET_NULL, related_name="bank_transactions")
    invoice = models.OneToOneField("funds.Invoice", null=True, blank=True,
                                   on_delete=models.SET_NULL, related_name="transaction")
    note = models.CharField(max_length=255, blank=True)
    raw = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.CheckConstraint(condition=Q(amount__gt=0), name="tx_amount_gt_0")]
        ordering = ["-occurred_at"]


class BankOutflow(models.Model):
    """Giao dịch tiền RA khỏi tài khoản ngân hàng của quỹ (do Casso gửi về)."""
    dedupe_key = models.CharField(max_length=64, unique=True)
    amount = models.PositiveBigIntegerField()
    content = models.CharField(max_length=500, blank=True)
    counterparty = models.CharField("Người nhận", max_length=255, blank=True)
    occurred_at = models.DateTimeField()
    note = models.CharField("Ghi chú", max_length=500, blank=True)
    raw = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-occurred_at", "-id"]
        constraints = [models.CheckConstraint(condition=Q(amount__gt=0), name="outflow_amount_gt_0")]