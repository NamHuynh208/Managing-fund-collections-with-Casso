import logging
from datetime import date

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from django.db.models import Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from ninja import Field, Router, Schema
from ninja.errors import HttpError
from ninja.security import SessionAuth

from apps.accounts import services as acc
from apps.accounts.models import RegistrationRequest, User
from apps.funds.audit import log as audit
from apps.funds.models import FeePeriod, Invoice
from apps.payments.models import BankOutflow

log = logging.getLogger(__name__)


class TreasurerAuth(SessionAuth):
    """Phải đăng nhập, đang hoạt động và là thủ quỹ. Sai thì trả 401."""
    def authenticate(self, request, key):
        u = request.user
        if u.is_authenticated and u.is_active and u.is_treasurer:
            return u


router = Router(auth=TreasurerAuth(), tags=["treasurer-extra"])   # gắn vào /treasurer
public_router = Router(tags=["public"])                            # gắn vào /auth


# ---------- Schemas ----------
class RegisterIn(Schema):
    email: str
    full_name: str
    note: str = ""

class PeriodUpdateIn(Schema):
    name: str = Field(..., min_length=1, max_length=120)
    amount: int = Field(..., gt=0)
    due_date: date

class NoteIn(Schema):
    note: str = ""


# ---------- Công khai: đăng ký thành viên ----------
@public_router.post("/register", auth=None)
def register(request, data: RegisterIn):
    if acc.hit_limit(f"register-ip:{acc.client_ip(request)}", 5, 600):
        raise HttpError(429, "Bạn gửi quá nhiều lần, hãy thử lại sau ít phút.")

    email = data.email.strip().lower()
    name = " ".join(data.full_name.split())
    try:
        validate_email(email)
    except ValidationError:
        raise HttpError(400, "Email không hợp lệ.")
    if not (2 <= len(name) <= 120):
        raise HttpError(400, "Họ tên cần từ 2 đến 120 ký tự.")

    # Đã là thành viên hoặc đã có đơn chờ thì không tạo thêm, nhưng vẫn trả kết quả giống nhau
    exists = (User.objects.filter(email__iexact=email).exists()
              or RegistrationRequest.objects.filter(email=email, status="pending").exists())
    if not exists:
        try:
            RegistrationRequest.objects.create(email=email, full_name=name, note=data.note.strip()[:300])
        except IntegrityError:
            pass
    return {"ok": True}


# ---------- Thủ quỹ: duyệt đơn đăng ký ----------
@router.get("/registrations")
def registrations(request):
    qs = RegistrationRequest.objects.filter(status="pending").order_by("created_at")
    return {
        "pending": qs.count(),
        "items": [{"id": r.id, "full_name": r.full_name, "email": r.email,
                   "note": r.note, "created_at": r.created_at} for r in qs],
    }


def _notify_approved(user):
    try:
        send_mail(
            "Đơn đăng ký Quỹ CLB đã được duyệt",
            f"Chào {user.full_name},\n\nĐơn đăng ký của bạn đã được duyệt. "
            f"Hãy đăng nhập bằng email này tại: {settings.FRONTEND_URL}/login",
            None, [user.email],
        )
    except Exception:
        log.exception("Gửi email báo duyệt thất bại")


@router.post("/registrations/{rid}/approve")
def approve_registration(request, rid: int):
    with transaction.atomic():
        r = get_object_or_404(RegistrationRequest.objects.select_for_update(), pk=rid, status="pending")
        if User.objects.filter(email__iexact=r.email).exists():
            raise HttpError(400, "Email này đã có trong danh sách thành viên. Hãy bấm Từ chối để dọn đơn.")
        u = User.objects.create_user(r.email, full_name=r.full_name)
        r.status = RegistrationRequest.Status.APPROVED
        r.reviewed_by = request.user
        r.reviewed_at = timezone.now()
        r.save(update_fields=["status", "reviewed_by", "reviewed_at"])
        audit(request.user, "member.approve", f"user={u.pk} request={r.pk}")
    _notify_approved(u)
    return {"id": u.id}


@router.post("/registrations/{rid}/reject")
def reject_registration(request, rid: int):
    r = get_object_or_404(RegistrationRequest, pk=rid, status="pending")
    r.status = RegistrationRequest.Status.REJECTED
    r.reviewed_by = request.user
    r.reviewed_at = timezone.now()
    r.save(update_fields=["status", "reviewed_by", "reviewed_at"])
    audit(request.user, "member.reject", f"request={r.pk}")
    return {"ok": True}


# ---------- Thủ quỹ: sửa / xóa kỳ thu ----------
@router.post("/periods/{period_id}/update")
def update_period(request, period_id: int, data: PeriodUpdateIn):
    name = data.name.strip()
    if not name:
        raise HttpError(400, "Tên kỳ không được để trống.")
    with transaction.atomic():
        p = get_object_or_404(FeePeriod.objects.select_for_update(), pk=period_id)
        old_amount = p.amount
        p.name, p.amount, p.due_date = name, data.amount, data.due_date
        p.save(update_fields=["name", "amount", "due_date"])
        changed = 0
        if data.amount != old_amount:
            # Chỉ hóa đơn CHƯA ĐÓNG đổi theo số tiền mới
            changed = p.invoices.filter(status=Invoice.Status.PENDING).update(amount=data.amount)
    audit(request.user, "period.update", f"period={p.pk} amount={old_amount}->{data.amount} invoices={changed}")
    return {"ok": True, "updated_invoices": changed}


@router.post("/periods/{period_id}/delete")
def delete_period(request, period_id: int):
    with transaction.atomic():
        p = get_object_or_404(FeePeriod.objects.select_for_update(), pk=period_id)
        if p.invoices.filter(status=Invoice.Status.PAID).exists():
            raise HttpError(400, "Kỳ này đã có người đóng nên không xóa được. "
                                 "Hãy sửa kỳ thu hoặc hủy từng hóa đơn chưa đóng.")
        label = f"{p.pk} {p.name}"
        p.invoices.all().delete()
        p.delete()
    audit(request.user, "period.delete", f"period={label}")
    return {"ok": True}


@router.post("/invoices/{invoice_id}/cancel")
def cancel_invoice(request, invoice_id: int):
    with transaction.atomic():
        inv = get_object_or_404(Invoice.objects.select_for_update(),
                                pk=invoice_id, status=Invoice.Status.PENDING)
        inv.status = Invoice.Status.CANCELLED
        inv.save(update_fields=["status"])
    audit(request.user, "invoice.cancel", f"invoice={invoice_id}")
    return {"ok": True}


# ---------- Thủ quỹ: lịch sử chuyển đi ----------
@router.get("/outflows")
def outflows(request):
    total = BankOutflow.objects.aggregate(s=Sum("amount"))["s"] or 0
    items = BankOutflow.objects.all()[:300]
    return {
        "total": total,
        "items": [{"id": o.id, "amount": o.amount, "content": o.content,
                   "counterparty": o.counterparty, "occurred_at": o.occurred_at,
                   "note": o.note} for o in items],
    }


@router.post("/outflows/{oid}/note")
def outflow_note(request, oid: int, data: NoteIn):
    o = get_object_or_404(BankOutflow, pk=oid)
    o.note = data.note.strip()[:500]
    o.save(update_fields=["note"])
    audit(request.user, "outflow.note", f"outflow={o.pk}")
    return {"ok": True}