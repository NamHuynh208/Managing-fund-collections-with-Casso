import csv, hashlib, io, logging, re
from datetime import datetime
from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from apps.accounts.models import User
from apps.funds.audit import log as audit
from apps.funds.models import Invoice
from .models import BankTransaction

logger = logging.getLogger(__name__)
CODE_RE = re.compile(r"QUY[0-9A-F]{6}")

# Sửa tên cột theo file sao kê thật của ngân hàng
STATEMENT_COLUMNS = {"ref": "Số tham chiếu", "date": "Ngày giao dịch",
                     "credit": "Ghi có", "content": "Nội dung"}


def fingerprint(amount, content, occurred_at) -> str:
    """Dùng khi ngân hàng không cho mã giao dịch. Độ chính xác đến phút."""
    norm = re.sub(r"\s+", "", content.upper())
    raw = f"{occurred_at:%Y%m%d%H%M}|{amount}|{norm}"
    return "fp-" + hashlib.sha1(raw.encode()).hexdigest()


def send_paid_email(invoice_id):
    inv = Invoice.objects.select_related("member", "period").get(pk=invoice_id)
    try:
        send_mail(
            f"Đã nhận quỹ: {inv.period.name}",
            f"Chào {inv.member.full_name},\n\nQuỹ đã ghi nhận khoản {inv.amount:,} đ cho \"{inv.period.name}\". Cảm ơn bạn!",
            None, [inv.member.email],
        )
    except Exception:
        logger.exception("Gửi email xác nhận thất bại")


def mark_paid(invoice, tx, actor=None, note=""):
    invoice.status = Invoice.Status.PAID
    invoice.paid_at = tx.occurred_at
    invoice.save(update_fields=["status", "paid_at"])
    tx.invoice, tx.member, tx.status = invoice, invoice.member, BankTransaction.Status.MATCHED
    if note:
        tx.note = note
    tx.save(update_fields=["invoice", "member", "status", "note"])
    audit(actor, "invoice.paid", f"invoice={invoice.pk} tx={tx.pk} amount={tx.amount}")
    transaction.on_commit(lambda: send_paid_email(invoice.pk))


def reconcile(tx):
    """Chạy trong transaction. Chỉ tự khớp khi mã đúng VÀ số tiền đúng hóa đơn."""
    m = CODE_RE.search(re.sub(r"\s+", "", tx.content.upper()))
    if not m:
        tx.note = "Không thấy mã chuyển khoản"
        tx.save(update_fields=["note"])
        return
    user = User.objects.filter(transfer_code=m.group()).first()
    if not user:
        tx.status, tx.note = BankTransaction.Status.REVIEW, "Mã không khớp thành viên nào"
        tx.save(update_fields=["status", "note"])
        return
    tx.member = user
    pending = Invoice.objects.select_for_update().filter(
        member=user, status=Invoice.Status.PENDING).order_by("period__due_date")
    exact = next((i for i in pending if i.amount == tx.amount), None)
    if exact:
        mark_paid(exact, tx)
        return
    tx.status = BankTransaction.Status.REVIEW
    tx.note = "Không có hóa đơn đúng số tiền (thiếu / thừa / đã đóng rồi)"
    tx.save(update_fields=["member", "status", "note"])


@transaction.atomic
def record_transaction(*, dedupe_key, amount, content, occurred_at, source, raw=""):
    tx, created = BankTransaction.objects.get_or_create(
        dedupe_key=dedupe_key,
        defaults=dict(amount=amount, content=content[:500], occurred_at=occurred_at, source=source, raw=raw),
    )
    if created:
        reconcile(tx)
    return tx, created


def import_statement(file_obj):
    rows = csv.DictReader(io.StringIO(file_obj.read().decode("utf-8-sig")))
    c, stats = STATEMENT_COLUMNS, {"new": 0, "duplicate": 0, "skipped": 0}
    for row in rows:
        credit = re.sub(r"[^\d]", "", row.get(c["credit"], "") or "")
        if not credit or int(credit) == 0:       # bỏ dòng tiền ra
            stats["skipped"] += 1
            continue
        when = timezone.make_aware(datetime.strptime(row[c["date"]].strip(), settings.STATEMENT_DATE_FORMAT))
        amount, content = int(credit), row[c["content"]].strip()
        key = (row.get(c["ref"]) or "").strip() or fingerprint(amount, content, when)
        _, created = record_transaction(dedupe_key=key, amount=amount, content=content,
                                        occurred_at=when, source=BankTransaction.Source.STATEMENT,
                                        raw=str(dict(row))[:2000])
        stats["new" if created else "duplicate"] += 1
    return stats