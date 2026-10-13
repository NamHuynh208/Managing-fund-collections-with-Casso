import hashlib, hmac, logging, secrets
from datetime import timedelta
from django.conf import settings
from django.core.cache import cache
from django.core.mail import send_mail
from django.urls import reverse
from django.utils import timezone
from django.db import transaction
from .models import LoginToken, User

LOGIN_COOLDOWN_SECONDS = 60
log = logging.getLogger(__name__)


def _h(value: str) -> str:
    return hmac.new(settings.SECRET_KEY.encode(), value.encode(), hashlib.sha256).hexdigest()


def client_ip(request) -> str:
    # Header của Cloudflare, chỉ đáng tin vì cổng backend chỉ nhận qua tunnel
    return request.META.get("HTTP_CF_CONNECTING_IP") or request.META.get("REMOTE_ADDR", "")


def hit_limit(key: str, limit: int, window: int) -> bool:
    """True nếu đã vượt giới hạn. (LocMemCache tính riêng từng worker nên chỉ là mức xấp xỉ.)"""
    cache.add(key, 0, window)
    try:
        return cache.incr(key) > limit
    except ValueError:
        return False


def issue_login(email: str, request, portal: str = "member") -> None:
    user = User.objects.filter(email__iexact=email.strip(), is_active=True).first()
    if not user or not can_use_portal(user, portal):
        return  # không báo cho người ngoài biết lý do

    now = timezone.now()
    token = secrets.token_urlsafe(32)
    code = f"{secrets.randbelow(10**6):06d}"
    ttl = settings.MAGIC_LINK_TTL_MINUTES

    with transaction.atomic():
        # Khóa dòng của người dùng: hai request cùng lúc sẽ phải xếp hàng
        User.objects.select_for_update().get(pk=user.pk)

        # Vừa gửi trong 60 giây qua: bỏ qua, mã trước đó vẫn còn dùng được
        if LoginToken.objects.filter(
            user=user, created_at__gte=now - timedelta(seconds=LOGIN_COOLDOWN_SECONDS)
        ).exists():
            return
        # Giới hạn 3 lần trong 10 phút
        if LoginToken.objects.filter(
            user=user, created_at__gte=now - timedelta(minutes=10)
        ).count() >= 3:
            return

        LoginToken.objects.create(
            user=user, token_hash=_h(token), code_hash=_h(code),
            expires_at=now + timedelta(minutes=ttl),
        )

    link = f"{settings.FRONTEND_URL}/auth/verify?token={token}&portal={portal}"
    body = (
        f"Chào {user.full_name},\n\n"
        f"Bấm vào liên kết để đăng nhập (hiệu lực {ttl} phút, dùng một lần):\n{link}\n\n"
        f"Hoặc nhập mã: {code}\n\n"
        "Nếu bạn không yêu cầu, hãy bỏ qua email này."
    )
    try:
        send_mail("Đăng nhập Quỹ CLB", body, None, [user.email])
    except Exception:
        log.exception("Gửi email đăng nhập thất bại")


def find_by_token(token: str):
    return LoginToken.objects.select_related("user").filter(
        token_hash=_h(token), used_at__isnull=True,
        expires_at__gt=timezone.now(), user__is_active=True,
    ).first()


def check_code(user, code: str):
    lt = LoginToken.objects.filter(
        user=user, used_at__isnull=True, expires_at__gt=timezone.now()
    ).order_by("-created_at").first()
    if not lt or lt.attempts >= 5:
        return None
    if hmac.compare_digest(lt.code_hash, _h(code)):
        return lt
    lt.attempts += 1
    lt.save(update_fields=["attempts"])
    return None


def consume(lt: LoginToken) -> bool:
    """Dùng token đúng một lần, an toàn khi có hai request cùng lúc."""
    ok = LoginToken.objects.filter(pk=lt.pk, used_at__isnull=True).update(used_at=timezone.now()) == 1
    if ok:
        LoginToken.objects.filter(user=lt.user, used_at__isnull=True).update(used_at=timezone.now())
    return ok




PORTALS = ("member", "treasurer", "admin")


def can_use_portal(user, portal: str) -> bool:
    """Người này có đủ vai trò để đăng nhập vào cổng đã chọn không."""
    if portal == "member":
        return True
    if portal == "treasurer":
        return user.is_treasurer
    if portal == "admin":
        return user.is_staff
    return False


def landing(portal: str) -> str:
    return {"member": "/", "treasurer": "/thu-quy", "admin": "/admin/"}.get(portal, "/")