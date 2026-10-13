import csv
from datetime import date

from django.conf import settings
from django.contrib.auth import login, logout
from django.db import transaction
from django.db.models import Count, Q
from django.http import HttpResponse, JsonResponse
from django.middleware.csrf import get_token
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie
from ninja import File, NinjaAPI, Schema, UploadedFile
from ninja.errors import HttpError
from ninja.security import django_auth

from apps.accounts import services as acc
from apps.accounts.models import User
from apps.funds.audit import log as audit
from apps.funds.models import Expense, FeePeriod, Invoice
from apps.funds.qr import vietqr_payload
from apps.funds.services import create_period, fund_summary
from apps.payments import services as pay
from apps.payments.models import BankTransaction

# Mặc định: bắt buộc đăng nhập và kiểm tra CSRF với request ghi
api = NinjaAPI(title="Quỹ CLB API", auth=django_auth)

OPEN = [BankTransaction.Status.REVIEW, BankTransaction.Status.UNMATCHED]


def need_treasurer(request):
    if not request.user.is_treasurer:
        raise HttpError(403, "Không có quyền")


# ---------- Schemas ----------
class EmailIn(Schema):
    email: str
    portal: str = "member"

class TokenIn(Schema):
    token: str
    portal: str = "member"

class CodeIn(Schema):
    email: str
    code: str
    portal: str = "member"

 
class ExpenseIn(Schema):
    amount: int
    reason: str
    spent_at: date



# ---------- Công khai ----------
@ensure_csrf_cookie
def _csrf_view(request):
    return JsonResponse({"csrfToken": get_token(request)})


@api.get("/csrf", auth=None)
def csrf(request):
    return _csrf_view(request)


@api.post("/auth/request", auth=None)
def auth_request(request, data: EmailIn):
    if not acc.hit_limit(f"login-ip:{acc.client_ip(request)}", 10, 600):
        acc.issue_login(data.email, request, data.portal)
    return {"ok": True}          # luôn trả giống nhau


@api.post("/auth/verify-link", auth=None)
def verify_link(request, data: TokenIn):
    lt = acc.find_by_token(data.token)
    # Kiểm tra vai trò TRƯỚC khi dùng token
    if lt and acc.can_use_portal(lt.user, data.portal) and acc.consume(lt):
        login(request, lt.user)
        return {"ok": True, "next": acc.landing(data.portal)}
    raise HttpError(400, "Liên kết không hợp lệ hoặc đã hết hạn")


@api.post("/auth/verify-code", auth=None)
def verify_code(request, data: CodeIn):
    user = User.objects.filter(email__iexact=data.email, is_active=True).first()
    if not user or not acc.can_use_portal(user, data.portal):
        raise HttpError(400, "Mã không đúng hoặc đã hết hạn")
    lt = acc.check_code(user, data.code.strip())
    if lt and acc.consume(lt):
        login(request, lt.user)
        return {"ok": True, "next": acc.landing(data.portal)}
    raise HttpError(400, "Mã không đúng hoặc đã hết hạn")


# ---------- Thành viên ----------
@api.post("/auth/logout")
def do_logout(request):
    logout(request)
    return {"ok": True}


@api.get("/me")
def me(request):
    u = request.user
    return {"id": u.id, "full_name": u.full_name, "email": u.email,
            "role": u.role, "transfer_code": u.transfer_code}


@api.get("/me/invoices")
def my_invoices(request):
    u = request.user                      # luôn lọc theo request.user
    out = []
    for i in u.invoices.select_related("period").exclude(status=Invoice.Status.CANCELLED):
        out.append({
            "id": i.id, "period": i.period.name, "amount": i.amount,
            "due_date": i.period.due_date, "status": i.status, "paid_at": i.paid_at,
            "qr_payload": vietqr_payload(settings.BANK_BIN, settings.BANK_ACCOUNT_NO,
                                         i.amount, u.transfer_code) if i.status == "pending" else None,
        })
    return {"invoices": out,
            "bank": {"account_no": settings.BANK_ACCOUNT_NO, "account_name": settings.BANK_ACCOUNT_NAME}}







@api.get("/treasurer/periods/{period_id}/csv")
def period_csv(request, period_id: int):
    need_treasurer(request)
    p = get_object_or_404(FeePeriod, pk=period_id)
    resp = HttpResponse(content_type="text/csv; charset=utf-8")
    resp["Content-Disposition"] = f'attachment; filename="quy-{p.pk}.csv"'
    resp.write("\ufeff")                  # để Excel đọc đúng tiếng Việt
    w = csv.writer(resp)
    w.writerow(["Họ tên", "Email", "Số tiền", "Trạng thái", "Thời điểm đóng"])
    for i in p.invoices.select_related("member").order_by("member__full_name"):
        w.writerow([i.member.full_name, i.member.email, i.amount, i.get_status_display(),
                    i.paid_at.strftime("%d/%m/%Y %H:%M") if i.paid_at else ""])
    return resp


# ---------- Thủ quỹ: giao dịch ----------




@api.post("/treasurer/statements")
def statement_upload(request, file: UploadedFile = File(...)):
    need_treasurer(request)
    stats = pay.import_statement(file)
    audit(request.user, "statement.import", str(stats))
    return stats


# ---------- Thủ quỹ: khoản chi ----------
@api.get("/treasurer/expenses")
def expenses_list(request):
    need_treasurer(request)
    return {"items": [{"id": e.id, "amount": e.amount, "reason": e.reason, "spent_at": e.spent_at}
                      for e in Expense.objects.order_by("-spent_at")],
            "summary": fund_summary()}


@api.post("/treasurer/expenses")
def expenses_create(request, data: ExpenseIn):
    need_treasurer(request)
    if data.amount <= 0:
        raise HttpError(400, "Số tiền phải lớn hơn 0")
    e = Expense.objects.create(amount=data.amount, reason=data.reason,
                               spent_at=data.spent_at, created_by=request.user)
    audit(request.user, "expense.create", f"expense={e.pk} amount={e.amount}")
    return {"id": e.id}

from .treasurer import router as treasurer_router
api.add_router("/treasurer", treasurer_router)

from .casso import router as casso_router
api.add_router("/webhooks", casso_router)

from .extra import router as extra_router, public_router
api.add_router("/treasurer", extra_router)
api.add_router("/auth", public_router)