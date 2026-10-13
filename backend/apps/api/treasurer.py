from datetime import date

from django.db import transaction
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from ninja import Field, Router, Schema
from ninja.errors import HttpError
from ninja.security import SessionAuth

from apps.accounts.models import User
from apps.funds.audit import log as audit
from apps.funds.models import FeePeriod, Invoice
from apps.funds.services import create_period, fund_summary
from apps.payments import services as pay
from apps.payments.models import BankTransaction


class TreasurerAuth(SessionAuth):
    """Chỉ cho người đã đăng nhập VÀ là thủ quỹ đi qua. Người khác nhận lỗi 401."""
    def authenticate(self, request, key):
        u = request.user
        if u.is_authenticated and u.is_active and u.is_treasurer:
            return u


router = Router(auth=TreasurerAuth(), tags=["treasurer"])
OPEN = [BankTransaction.Status.REVIEW, BankTransaction.Status.UNMATCHED]


class PeriodIn(Schema):
    name: str = Field(..., min_length=1, max_length=120)
    amount: int = Field(..., gt=0)
    due_date: date
    member_ids: list[int] | None = None      # None = tất cả thành viên


class AssignIn(Schema):
    invoice_id: int


@router.get("/overview")
def overview(request):
    return {
        **fund_summary(),
        "review_count": BankTransaction.objects.filter(status__in=OPEN).count(),
        "unpaid_count": Invoice.objects.filter(status=Invoice.Status.PENDING).count(),
    }


@router.get("/members")
def members(request):
    qs = User.objects.filter(is_active=True).order_by("full_name")
    return {"members": [{"id": u.id, "full_name": u.full_name, "email": u.email} for u in qs]}


@router.get("/periods")
def periods(request):
    qs = FeePeriod.objects.annotate(
        total=Count("invoices"),
        paid=Count("invoices", filter=Q(invoices__status=Invoice.Status.PAID)),
    ).order_by("-due_date")
    return {
        "periods": [{"id": p.id, "name": p.name, "amount": p.amount, "due_date": p.due_date,
                     "total": p.total, "paid": p.paid} for p in qs],
        "summary": fund_summary(),
    }


@router.post("/periods")
def new_period(request, data: PeriodIn):
    ids = None
    if data.member_ids is not None:
        ids = list(set(data.member_ids))
        if not ids:
            raise HttpError(400, "Chưa chọn thành viên nào")
        if User.objects.filter(is_active=True, pk__in=ids).count() != len(ids):
            raise HttpError(400, "Có thành viên không hợp lệ")
    p = create_period(data.name.strip(), data.amount, data.due_date, ids)
    audit(request.user, "period.create",
          f"period={p.pk} members={'all' if ids is None else len(ids)}")
    return {"id": p.id}


@router.get("/periods/{period_id}")
def period_detail(request, period_id: int):
    p = get_object_or_404(FeePeriod, pk=period_id)
    invs = p.invoices.select_related("member").order_by("-status", "member__full_name")
    return {
        "id": p.id, "name": p.name, "amount": p.amount, "due_date": p.due_date,
        "invoices": [{"id": i.id, "member": i.member.full_name, "email": i.member.email,
                      "status": i.status, "paid_at": i.paid_at} for i in invs],
    }


@router.post("/invoices/{invoice_id}/cash")
def cash(request, invoice_id: int):
    """Thủ quỹ bấm 'đã nhận tiền mặt'."""
    with transaction.atomic():
        inv = get_object_or_404(Invoice.objects.select_for_update(),
                                pk=invoice_id, status=Invoice.Status.PENDING)
        tx = BankTransaction.objects.create(
            dedupe_key=f"cash-{inv.pk}", amount=inv.amount, content="Tiền mặt",
            occurred_at=timezone.now(), source=BankTransaction.Source.MANUAL)
        pay.mark_paid(inv, tx, actor=request.user, note="Tiền mặt")
    return {"ok": True}


@router.get("/transactions")
def transactions(request):
    txs = BankTransaction.objects.filter(status__in=OPEN).select_related("member")
    pending = (Invoice.objects.filter(status=Invoice.Status.PENDING)
               .select_related("member", "period").order_by("member__full_name"))
    return {
        "transactions": [{"id": t.id, "amount": t.amount, "content": t.content,
                          "occurred_at": t.occurred_at, "source": t.get_source_display(),
                          "note": t.note, "member_id": t.member_id,
                          "member": t.member.full_name if t.member else None} for t in txs],
        "pending_invoices": [{"id": i.id, "member_id": i.member_id, "member": i.member.full_name,
                              "period": i.period.name, "amount": i.amount} for i in pending],
    }


@router.post("/transactions/{tx_id}/assign")
def assign(request, tx_id: int, data: AssignIn):
    with transaction.atomic():
        tx = get_object_or_404(BankTransaction.objects.select_for_update(), pk=tx_id, status__in=OPEN)
        inv = get_object_or_404(Invoice.objects.select_for_update(),
                                pk=data.invoice_id, status=Invoice.Status.PENDING)
        if tx.amount < inv.amount:
            raise HttpError(400, "Giao dịch ít hơn số tiền hóa đơn, hãy xử lý thiếu tiền trước.")
        note = "Thừa tiền, cần hoàn/ghi nhận" if tx.amount > inv.amount else ""
        pay.mark_paid(inv, tx, actor=request.user, note=note)
    return {"ok": True}


@router.post("/transactions/{tx_id}/ignore")
def ignore(request, tx_id: int):
    tx = get_object_or_404(BankTransaction, pk=tx_id, status__in=OPEN)
    tx.status = BankTransaction.Status.IGNORED
    tx.save(update_fields=["status"])
    audit(request.user, "tx.ignore", f"tx={tx.pk}")
    return {"ok": True}