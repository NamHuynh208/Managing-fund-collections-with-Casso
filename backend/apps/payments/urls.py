from django.contrib import messages
from django.db import transaction
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from django.views.decorators.http import require_POST
from apps.accounts.permissions import treasurer_required
from apps.funds.audit import log as audit
from apps.funds.models import Invoice
from . import services
from .models import BankTransaction


@treasurer_required
def review(request):
    txs = BankTransaction.objects.filter(
        status__in=[BankTransaction.Status.REVIEW, BankTransaction.Status.UNMATCHED]
    ).select_related("member")
    pending = Invoice.objects.filter(status=Invoice.Status.PENDING).select_related("member", "period")
    return render(request, "payments/review.html", {"txs": txs, "pending": pending})


@treasurer_required
@require_POST
def assign(request, pk):
    with transaction.atomic():
        tx = get_object_or_404(BankTransaction.objects.select_for_update(), pk=pk,
                               status__in=[BankTransaction.Status.REVIEW, BankTransaction.Status.UNMATCHED])
        inv = get_object_or_404(Invoice.objects.select_for_update(),
                                pk=request.POST.get("invoice"), status=Invoice.Status.PENDING)
        if tx.amount < inv.amount:
            messages.error(request, "Giao dịch ít hơn số tiền hóa đơn, hãy xử lý thiếu tiền trước.")
        else:
            note = "Thừa tiền, cần hoàn/ghi nhận" if tx.amount > inv.amount else ""
            services.mark_paid(inv, tx, actor=request.user, note=note)
            messages.success(request, "Đã gán giao dịch.")
    return redirect("payments:review")


@treasurer_required
@require_POST
def ignore(request, pk):
    tx = get_object_or_404(BankTransaction, pk=pk)
    tx.status = BankTransaction.Status.IGNORED
    tx.save(update_fields=["status"])
    audit(request.user, "tx.ignore", f"tx={tx.pk}")
    return redirect("payments:review")


@treasurer_required
@require_POST
def cash(request, pk):
    """Ghi nhận thành viên đóng tiền mặt."""
    with transaction.atomic():
        inv = get_object_or_404(Invoice.objects.select_for_update(), pk=pk, status=Invoice.Status.PENDING)
        tx = BankTransaction.objects.create(
            dedupe_key=f"cash-{inv.pk}", amount=inv.amount, content="Tiền mặt",
            occurred_at=timezone.now(), source=BankTransaction.Source.MANUAL)
        services.mark_paid(inv, tx, actor=request.user, note="Tiền mặt")
    return redirect("funds:period", inv.period_id)


@treasurer_required
def upload_statement(request):
    stats = None
    if request.method == "POST" and request.FILES.get("file"):
        stats = services.import_statement(request.FILES["file"])
        audit(request.user, "statement.import", str(stats))
    return render(request, "payments/upload.html", {"stats": stats})