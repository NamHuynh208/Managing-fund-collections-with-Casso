from .models import AuditLog


def log(user, action, detail=""):
    AuditLog.objects.create(user=user, action=action, detail=detail)