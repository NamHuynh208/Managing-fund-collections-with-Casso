import logging, re
from datetime import datetime
from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone
from imap_tools import AND, MailBox, MailMessageFlags
from apps.payments.models import BankTransaction
from apps.payments.services import fingerprint, record_transaction

log = logging.getLogger(__name__)


def sender_verified(msg) -> bool:
    if msg.from_.lower() != settings.BANK_EMAIL_SENDER.lower():
        return False
    auth = " ".join(msg.headers.get("authentication-results", ())).lower()
    return "dkim=pass" in auth      # tránh email giả mạo


def parse_bank_email(text: str):
    """!!! PHẢI VIẾT LẠI THEO MẪU EMAIL THẬT CỦA NGÂN HÀNG BẠN !!!
    Trả về dict(amount, content, occurred_at, ref) hoặc None nếu không phải tiền VÀO.
    Các regex dưới đây chỉ là ví dụ minh họa."""
    amt = re.search(r"\+\s*([\d.,]+)\s*VND", text)
    content = re.search(r"Nội dung[:\s]+(.+)", text)
    when = re.search(r"(\d{2}/\d{2}/\d{4} \d{2}:\d{2}:\d{2})", text)
    ref = re.search(r"Mã giao dịch[:\s]+(\w+)", text)
    if not (amt and content and when):
        return None
    return {
        "amount": int(re.sub(r"[^\d]", "", amt.group(1))),
        "content": content.group(1).strip(),
        "occurred_at": timezone.make_aware(datetime.strptime(when.group(1), "%d/%m/%Y %H:%M:%S")),
        "ref": ref.group(1) if ref else None,
    }


class Command(BaseCommand):
    help = "Đọc email biến động số dư và ghi nhận giao dịch"

    def handle(self, *args, **opts):
        with MailBox(settings.IMAP_HOST).login(settings.IMAP_USER, settings.IMAP_PASSWORD) as mb:
            for msg in mb.fetch(AND(seen=False, from_=settings.BANK_EMAIL_SENDER), mark_seen=False):
                if not sender_verified(msg):
                    log.warning("Bỏ qua email không xác thực được người gửi: %s", msg.subject)
                    continue
                p = parse_bank_email(msg.text or msg.html or "")
                if p is None:
                    log.warning("Không phân tích được email: %s", msg.subject)
                    continue
                key = p["ref"] or fingerprint(p["amount"], p["content"], p["occurred_at"])
                tx, created = record_transaction(
                    dedupe_key=key, amount=p["amount"], content=p["content"],
                    occurred_at=p["occurred_at"], source=BankTransaction.Source.EMAIL,
                    raw=(msg.text or "")[:2000],
                )
                mb.flag(msg.uid, MailMessageFlags.SEEN, True)
                self.stdout.write(f"{'MỚI' if created else 'TRÙNG'} {key} {tx.status}")