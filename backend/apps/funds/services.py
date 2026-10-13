from django.conf import settings
from django.db import transaction
from django.db.models import Sum
from apps.accounts.models import User
from .models import Expense, FeePeriod, Invoice


@transaction.atomic
def create_period(name, amount, due_date, member_ids=None):
    """member_ids=None: tạo hóa đơn cho mọi thành viên đang hoạt động."""
    period = FeePeriod.objects.create(name=name, amount=amount, due_date=due_date)
    members = User.objects.filter(is_active=True)
    if member_ids is not None:
        members = members.filter(pk__in=member_ids)
    Invoice.objects.bulk_create(
        Invoice(member=m, period=period, amount=amount) for m in members
    )
    return period


def fund_summary():
    collected = Invoice.objects.filter(status=Invoice.Status.PAID).aggregate(s=Sum("amount"))["s"] or 0
    spent = Expense.objects.aggregate(s=Sum("amount"))["s"] or 0
    return {"collected": collected, "spent": spent,
            "balance": settings.OPENING_BALANCE + collected - spent}