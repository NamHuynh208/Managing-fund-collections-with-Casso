from django.conf import settings
from django.db import transaction
from django.db.models import Sum
from apps.accounts.models import User
from .models import Expense, FeePeriod, Invoice


@transaction.atomic
def create_period(name, amount, due_date):
    period = FeePeriod.objects.create(name=name, amount=amount, due_date=due_date)
    Invoice.objects.bulk_create(
        Invoice(member=m, period=period, amount=amount) for m in User.objects.filter(is_active=True)
    )
    return period


def fund_summary():
    collected = Invoice.objects.filter(status=Invoice.Status.PAID).aggregate(s=Sum("amount"))["s"] or 0
    spent = Expense.objects.aggregate(s=Sum("amount"))["s"] or 0
    return {"collected": collected, "spent": spent,
            "balance": settings.OPENING_BALANCE + collected - spent}