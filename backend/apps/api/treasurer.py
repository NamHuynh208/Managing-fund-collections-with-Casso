from datetime import date, timedelta
import logging

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncMonth
from django.shortcuts import get_object_or_404
from django.utils import timezone
from ninja import Field, Router, Schema
from ninja.errors import HttpError
from ninja.security import SessionAuth

from apps.accounts.models import User
from apps.funds.audit import log as audit
from apps.funds.models import Expense, FeePeriod, Invoice
from apps.funds.services import create_period, fund_summary
from apps.payments import services as pay
from apps.payments.models import BankTransaction

log = logging.getLogger(__name__)


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


def _monthly_stats(months: int = 6):
    """Thu/chi theo từng tháng (bao gồm tháng hiện tại), trả về danh sách tăng dần theo thời gian."""
    start = timezone.localdate().replace(day=1)
    # lùi (months - 1) tháng
    for _ in range(months - 1):
        start = (start.replace(day=1) - timedelta(days=1)).replace(day=1)
    collected = (
        Invoice.objects.filter(status=Invoice.Status.PAID, paid_at__date__gte=start)
        .annotate(m=TruncMonth("paid_at")).values("m").annotate(s=Sum("amount"))
    )
    spent = (
        Expense.objects.filter(spent_at__gte=start)
        .annotate(m=TruncMonth("spent_at")).values("m").annotate(s=Sum("amount"))
    )
    cmap = {r["m"].strftime("%Y-%m"): r["s"] for r in collected}
    smap = {r["m"].strftime("%Y-%m"): r["s"] for r in spent}
    out = []
    d = start
    for _ in range(months):
        key = d.strftime("%Y-%m")
        out.append({"month": key, "collected": cmap.get(key, 0), "spent": smap.get(key, 0)})
        d = (d.replace(day=1) + timedelta(days=32)).replace(day=1)
    return out


@router.get("/overview")
def overview(request):
    return {
        **fund_summary(),
        "review_count": BankTransaction.objects.filter(status__in=OPEN).count(),
        "unpaid_count": Invoice.objects.filter(status=Invoice.Status.PENDING).count(),
        "member_count": User.objects.filter(is_active=True, role=User.Role.MEMBER).count(),
        "monthly": _monthly_stats(),
    }


@router.get("/members")
def members(request):
    qs = (User.objects
          .annotate(paid_total=Sum("invoices__amount",
                                   filter=Q(invoices__status=Invoice.Status.PAID),
                                   default=0),
                    unpaid_count=Count("invoices",
                                       filter=Q(invoices__status=Invoice.Status.PENDING),
                                       distinct=True))
          .order_by("-is_active", "full_name"))
    return {"members": [{
        "id": u.id, "full_name": u.full_name, "email": u.email,
        "role": u.role, "is_active": u.is_active, "transfer_code": u.transfer_code,
        "paid_total": u.paid_total, "unpaid_count": u.unpaid_count,
    } for u in qs]}


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


@router.get("/transactions/history")
def transactions_history(request, status: str = "", q: str = "", limit: int = 200):
    """Toàn bộ giao dịch tiền vào, lọc theo trạng thái / từ khóa (nội dung, thành viên)."""
    qs = BankTransaction.objects.select_related("member", "invoice", "invoice__period")
    valid = {s for s, _ in BankTransaction.Status.choices}
    if status in valid:
        qs = qs.filter(status=status)
    if q.strip():
        qs = qs.filter(Q(content__icontains=q.strip())
                       | Q(member__full_name__icontains=q.strip()))
    qs = qs.order_by("-occurred_at")[: max(1, min(limit, 1000))]
    return {"items": [{
        "id": t.id, "amount": t.amount, "content": t.content,
        "occurred_at": t.occurred_at, "source": t.get_source_display(),
        "status": t.status, "status_display": t.get_status_display(),
        "member": t.member.full_name if t.member else None,
        "period": t.invoice.period.name if t.invoice else None,
        "note": t.note,
    } for t in qs]}


@router.post("/periods/{period_id}/remind")
def remind_period(request, period_id: int):
    """Gửi email nhắc những thành viên chưa đóng của một kỳ (mỗi kỳ 1 lần / 10 phút)."""
    p = get_object_or_404(FeePeriod, pk=period_id)
    pending = list(p.invoices.filter(status=Invoice.Status.PENDING).select_related("member"))

    from django.core.cache import cache
    if cache.get(f"remind:{p.pk}"):
        raise HttpError(429, "Vừa gửi nhắc cho kỳ này, hãy thử lại sau ít phút.")
    cache.set(f"remind:{p.pk}", 1, 600)

    sent = 0
    for inv in pending:
        try:
            send_mail(
                f"Nhắc đóng quỹ: {p.name}",
                f"Chào {inv.member.full_name},\n\n"
                f"Bạn còn khoản {inv.amount:,} đ cho \"{p.name}\", hạn "
                f"{p.due_date.strftime('%d/%m/%Y')}.\n"
                f"Đăng nhập tại {settings.FRONTEND_URL} để lấy mã QR chuyển khoản.\n\n"
                "Cảm ơn bạn!",
                None, [inv.member.email],
            )
            sent += 1
        except Exception:
            log.exception("Gửi email nhắc thất bại, invoice=%s", inv.pk)
    audit(request.user, "period.remind", f"period={p.pk} sent={sent}/{len(pending)}")
    return {"sent": sent, "total": len(pending)}