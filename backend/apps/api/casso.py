import hashlib
import hmac
import json
import logging
from datetime import datetime

from django.conf import settings
from django.utils import timezone
from ninja import Router
from ninja.errors import HttpError

from apps.payments.models import BankTransaction
from apps.payments.services import record_transaction
from apps.payments.models import BankOutflow, BankTransaction

log = logging.getLogger(__name__)
router = Router(tags=["webhooks"])


def _sort_keys(obj):
    """Sắp xếp key A-Z (đệ quy trên object), đúng như code mẫu của Casso."""
    if isinstance(obj, dict):
        return {k: _sort_keys(obj[k]) for k in sorted(obj)}
    return obj


def _verify_v2(header: str, payload: dict, key: str) -> bool:
    """Header X-Casso-Signature dạng 't=...,v1=...'.
    Chữ ký = HMAC-SHA512(key, f"{t}.{JSON gọn đã sắp xếp key}") dạng hex."""
    try:
        parts = dict(p.strip().split("=", 1) for p in header.split(","))
        t, sig = parts["t"], parts["v1"]
    except (ValueError, KeyError):
        return False
    data = _sort_keys(payload)
    for ensure_ascii in (True, False):        # thử cả hai kiểu mã hóa ký tự có dấu
        body = json.dumps(data, separators=(",", ":"), ensure_ascii=ensure_ascii)
        gen = hmac.new(key.encode(), f"{t}.{body}".encode(), hashlib.sha512).hexdigest()
        if hmac.compare_digest(gen, sig):
            return True
    return False


def _parse_when(s: str):
    """Một số ngân hàng chỉ trả ngày, không có giờ phút giây."""
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return timezone.make_aware(datetime.strptime(s.strip(), fmt))
        except ValueError:
            continue
    return timezone.now()


@router.post("/casso", auth=None)
def casso_webhook(request):
    key = settings.CASSO_SECURE_KEY
    if not key:
        raise HttpError(503, "Chưa cấu hình CASSO_SECURE_KEY")

    try:
        payload = json.loads(request.body)
    except ValueError:
        raise HttpError(400, "JSON không hợp lệ")
    if not isinstance(payload, dict):
        raise HttpError(400, "Dữ liệu không hợp lệ")

    # 1) Xác thực chữ ký (Webhook V2)
    sig = request.headers.get("X-Casso-Signature", "")
    if not sig or not _verify_v2(sig, payload, key):
        log.warning("Casso 401: sig=%r body=%r", sig[:40], request.body[:600])
        raise HttpError(401, "Unauthorized")

    if payload.get("error") not in (0, "0", None):
        return {"success": True}

    # 2) Webhook V2 gửi 1 object giao dịch trong "data"
    it = payload.get("data")
    if not isinstance(it, dict):
        return {"success": True}

    amount, tx_id = it.get("amount"), it.get("id")
    if tx_id is not None and isinstance(amount, (int, float)) and amount != 0:
        when = _parse_when(it.get("transactionDateTime") or "")
        content = it.get("description") or ""
        raw = json.dumps(it, ensure_ascii=False)[:2000]

        if amount > 0:
            # Tiền VÀO: đối soát với hóa đơn
            tx, created = record_transaction(
                dedupe_key=f"casso-{tx_id}",
                amount=int(amount),
                content=content,
                occurred_at=when,
                source=BankTransaction.Source.CASSO,
                raw=raw,
            )
            log.info("Casso tx %s %s -> %s", tx_id, "mới" if created else "trùng", tx.status)
        else:
            # Tiền RA: chỉ lưu để thủ quỹ xem và ghi chú
            _, created = BankOutflow.objects.get_or_create(
                dedupe_key=f"casso-{tx_id}",
                defaults=dict(
                    amount=int(-amount),
                    content=content[:500],
                    counterparty=(it.get("counterAccountName") or "")[:255],
                    occurred_at=when,
                    raw=raw,
                ),
            )
            log.info("Casso outflow %s %s", tx_id, "mới" if created else "trùng")
    # Casso (Strict mode) cần HTTP 200 + success true. Trùng hoặc không khớp vẫn trả success.
    return {"success": True}