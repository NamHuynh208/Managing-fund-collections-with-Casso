import secrets
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create(self, email, password, **extra):
        if not email:
            raise ValueError("Thiếu email")
        user = self.model(email=self.normalize_email(email).lower(), **extra)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()   # thành viên chỉ đăng nhập bằng magic link
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra):
        return self._create(email, password, **extra)

    def create_superuser(self, email, password=None, **extra):
        extra.update(is_staff=True, is_superuser=True, role="treasurer")
        return self._create(email, password, **extra)


class User(AbstractUser):
    class Role(models.TextChoices):
        MEMBER = "member", "Thành viên"
        TREASURER = "treasurer", "Thủ quỹ"

    username = None
    email = models.EmailField(unique=True)
    full_name = models.CharField("Họ tên", max_length=120)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.MEMBER)
    # Mã đặt trong nội dung chuyển khoản. Chỉ gồm chữ + số vì nhiều ngân hàng xóa ký tự đặc biệt
    transfer_code = models.CharField(
    max_length=12,
    unique=True,
    editable=False,
    null=True,
    blank=True,
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["full_name"]
    objects = UserManager()

    @property
    def is_treasurer(self):
        return self.role == self.Role.TREASURER

    def save(self, *args, **kwargs):
        if not self.transfer_code:
            while True:
                code = "QUY" + secrets.token_hex(3).upper()
                if not User.objects.filter(transfer_code=code).exists():
                    self.transfer_code = code
                    break
        self.email = self.email.lower()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.full_name} <{self.email}>"


class LoginToken(models.Model):
    """Mỗi lần xin đăng nhập: 1 token trong link + 1 mã 6 số. Chỉ lưu bản băm."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="login_tokens")
    token_hash = models.CharField(max_length=64, unique=True)
    code_hash = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    attempts = models.PositiveSmallIntegerField(default=0)