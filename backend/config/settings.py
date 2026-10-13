from pathlib import Path
import environ



BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(
DEBUG=(bool, True),
)



environ.Env.read_env(BASE_DIR.parent / ".env")


SECRET_KEY = env(
"SECRET_KEY",
default="django-insecure-dev-only-change-this",
)

DEBUG = env.bool("DEBUG", default=True)

ALLOWED_HOSTS = env.list(
    "ALLOWED_HOSTS",
    default=env.list("DJANGO_ALLOWED_HOSTS", default=["localhost", "127.0.0.1"]),
)






INSTALLED_APPS = [
"django.contrib.admin",
"django.contrib.auth",
"django.contrib.contenttypes",
"django.contrib.sessions",
"django.contrib.messages",
"django.contrib.staticfiles",

"apps.accounts",
"apps.funds",
"apps.payments",
"apps.api",


]



MIDDLEWARE = [
"django.middleware.security.SecurityMiddleware",
"whitenoise.middleware.WhiteNoiseMiddleware",

"django.contrib.sessions.middleware.SessionMiddleware",
"django.middleware.common.CommonMiddleware",
"django.middleware.csrf.CsrfViewMiddleware",
"django.contrib.auth.middleware.AuthenticationMiddleware",
"django.contrib.messages.middleware.MessageMiddleware",
"django.middleware.clickjacking.XFrameOptionsMiddleware",


]



ROOT_URLCONF = "config.urls"

TEMPLATES = [
{
"BACKEND": "django.template.backends.django.DjangoTemplates",
"DIRS": [],
"APP_DIRS": True,
"OPTIONS": {
"context_processors": [
"django.template.context_processors.request",
"django.contrib.auth.context_processors.auth",
"django.contrib.messages.context_processors.messages",
],
},
},
]

WSGI_APPLICATION = "config.wsgi.application"



DATABASES = {
"default": env.db(
"DATABASE_URL",
default="postgres://quy_app:nhatnamhuynh1607@db:5432/quy",
)
}



AUTH_USER_MODEL = "accounts.User"



AUTH_PASSWORD_VALIDATORS = [
{
"NAME": (
"django.contrib.auth.password_validation."
"UserAttributeSimilarityValidator"
),
},
{
"NAME": (
"django.contrib.auth.password_validation."
"MinimumLengthValidator"
),
},
{
"NAME": (
"django.contrib.auth.password_validation."
"CommonPasswordValidator"
),
},
{
"NAME": (
"django.contrib.auth.password_validation."
"NumericPasswordValidator"
),
},
]



LANGUAGE_CODE = "vi"

TIME_ZONE = "Asia/Ho_Chi_Minh"

USE_I18N = True
USE_TZ = True



SESSION_COOKIE_AGE = 60 * 60 * 24 * 14
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"



CSRF_COOKIE_HTTPONLY = False


# --- Email thật ---
EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")
EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=False)

CSRF_TRUSTED_ORIGINS = env.list(
"CSRF_TRUSTED_ORIGINS",
default=["http://localhost:5173"],
)

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = env.bool("COOKIE_SECURE", default=False)
CSRF_COOKIE_SECURE = SESSION_COOKIE_SECURE

FRONTEND_URL = env(
"FRONTEND_URL",
default="http://localhost:5173",
)



MAGIC_LINK_TTL_MINUTES = env.int(
"MAGIC_LINK_TTL_MINUTES",
default=15,
)



BANK_BIN = env(
"BANK_BIN",
default="",
)

BANK_ACCOUNT_NO = env(
"BANK_ACCOUNT_NO",
default="",
)

BANK_ACCOUNT_NAME = env(
"BANK_ACCOUNT_NAME",
default="",
)

OPENING_BALANCE = env.int(
"OPENING_BALANCE",
default=0,
)


IMAP_HOST = env(
"IMAP_HOST",
default="imap.gmail.com",
)

IMAP_USER = env(
"IMAP_USER",
default="",
)

IMAP_PASSWORD = env(
"IMAP_PASSWORD",
default="",
)

BANK_EMAIL_SENDER = env(
"BANK_EMAIL_SENDER",
default="",
)

STATEMENT_DATE_FORMAT = "%d/%m/%Y %H:%M:%S"



STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

STORAGES = {
"default": {
"BACKEND": "django.core.files.storage.FileSystemStorage",
},
"staticfiles": {
"BACKEND": (
"whitenoise.storage.CompressedManifestStaticFilesStorage"
),
},
}
# --- Bảo mật khi chạy thật ---
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = "DENY"



DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = env("EMAIL_HOST", default="mailpit")
EMAIL_PORT = env.int("EMAIL_PORT", default=1025)
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="quy@localhost")

CASSO_SECURE_KEY = env("CASSO_SECURE_KEY", default="")