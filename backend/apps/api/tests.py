"""Test cho toàn bộ API chính: đăng nhập magic link, kỳ thu, giao dịch,
Casso webhook và các endpoint mới (members, expenses, audit, history, remind)."""
import hashlib
import hmac
import json
import re
import time as time_mod
from datetime import date, timedelta

from django.core import mail
from django.test import Client, TestCase, override_settings
from django.utils import timezone

from apps.accounts.models import RegistrationRequest, User
from apps.funds.models import AuditLog, Expense, FeePeriod, Invoice
from apps.payments.models import BankOutflow, BankTransaction
from apps.payments.services import record_transaction


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class AuthFlowTests(TestCase):
    def setUp(self):
        self.c = Client()
        self.member = User.objects.create_user("member@x.vn", full_name="Nguyen Van A")
        self.treasurer = User.objects.create_user("thuquy@x.vn", full_name="Tran Thu Quy", role="treasurer")

    def post_json(self, path, body):
        return self.c.post(path, data=json.dumps(body), content_type="application/json")

    def test_magic_link_login_member(self):
        r = self.post_json("/api/auth/request", {"email": "member@x.vn", "portal": "member"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        code = re.search(r"mã: (\d{6})", mail.outbox[0].body).group(1)
        r2 = self.post_json("/api/auth/verify-code", {"email": "member@x.vn", "code": code, "portal": "member"})
        self.assertEqual(r2.status_code, 200, r2.content)
        r3 = self.c.get("/api/me")
        self.assertEqual(r3.json()["email"], "member@x.vn")

    def test_member_cannot_use_treasurer_portal(self):
        self.post_json("/api/auth/request", {"email": "member@x.vn", "portal": "treasurer"})
        self.assertEqual(len(mail.outbox), 0)  # không gửi thư cho người thiếu quyền

    def test_treasurer_portal_ok(self):
        self.post_json("/api/auth/request", {"email": "thuquy@x.vn", "portal": "treasurer"})
        self.assertEqual(len(mail.outbox), 1)
        code = re.search(r"mã: (\d{6})", mail.outbox[0].body).group(1)
        r = self.post_json("/api/auth/verify-code", {"email": "thuquy@x.vn", "code": code, "portal": "treasurer"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["next"], "/thu-quy")

    def test_wrong_code_rejected(self):
        self.post_json("/api/auth/request", {"email": "member@x.vn", "portal": "member"})
        r = self.post_json("/api/auth/verify-code", {"email": "member@x.vn", "code": "000000", "portal": "member"})
        self.assertEqual(r.status_code, 400)

    def test_my_invoices_hide_qr_when_paid(self):
        p = FeePeriod.objects.create(name="T10", amount=50_000, due_date=date.today())
        Invoice.objects.create(member=self.member, period=p, amount=50_000,
                               status=Invoice.Status.PAID, paid_at=timezone.now())
        self.c.force_login(self.member)
        data = self.c.get("/api/me/invoices").json()
        self.assertIsNone(data["invoices"][0]["qr_payload"])
        self.assertIn("account_no", data["bank"])


class TreasurerBase(TestCase):
    def setUp(self):
        self.treasurer = User.objects.create_user("thuquy@x.vn", full_name="Tran Thu Quy", role="treasurer")
        self.member = User.objects.create_user("member@x.vn", full_name="Nguyen Van A")
        self.c = Client()
        self.c.force_login(self.treasurer)

    def post_json(self, path, body):
        return self.c.post(path, data=json.dumps(body), content_type="application/json")


class OverviewTests(TreasurerBase):
    def test_overview_has_monthly_and_counts(self):
        p = FeePeriod.objects.create(name="T10", amount=50_000, due_date=date.today())
        Invoice.objects.create(member=self.member, period=p, amount=50_000,
                               status=Invoice.Status.PAID, paid_at=timezone.now())
        Expense.objects.create(amount=20_000, reason="mua cờ", spent_at=date.today())
        r = self.c.get("/api/treasurer/overview").json()
        self.assertEqual(r["collected"], 50_000)
        self.assertEqual(r["spent"], 20_000)
        self.assertEqual(r["balance"], 30_000)
        self.assertEqual(r["member_count"], 1)
        self.assertTrue(any(m["collected"] == 50_000 for m in r["monthly"]))

    def test_overview_forbidden_for_member(self):
        c2 = Client()
        c2.force_login(self.member)
        self.assertEqual(c2.get("/api/treasurer/overview").status_code, 401)


class MembersTests(TreasurerBase):
    def test_members_list_fields(self):
        r = self.c.get("/api/treasurer/members").json()
        m = next(x for x in r["members"] if x["email"] == "member@x.vn")
        self.assertTrue(m["transfer_code"].startswith("QUY"))
        self.assertEqual(m["role"], "member")
        self.assertTrue(m["is_active"])

    def test_change_role_and_lock(self):
        self.post_json(f"/api/treasurer/members/{self.member.pk}/update", {"role": "treasurer"})
        self.member.refresh_from_db()
        self.assertEqual(self.member.role, "treasurer")

        self.post_json(f"/api/treasurer/members/{self.member.pk}/update", {"is_active": False})
        self.member.refresh_from_db()
        self.assertFalse(self.member.is_active)

    def test_cannot_modify_self(self):
        r = self.post_json(f"/api/treasurer/members/{self.treasurer.pk}/update", {"is_active": False})
        self.assertEqual(r.status_code, 400)

    def test_audit_logged(self):
        self.post_json(f"/api/treasurer/members/{self.member.pk}/update", {"role": "treasurer"})
        self.assertTrue(AuditLog.objects.filter(action="member.update").exists())


class PeriodTests(TreasurerBase):
    @override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
    def test_create_period_and_remind(self):
        r = self.post_json("/api/treasurer/periods", {
            "name": "Quỹ tháng 10", "amount": 50_000,
            "due_date": str(date.today() + timedelta(days=7)), "member_ids": None})
        self.assertEqual(r.status_code, 200, r.content)
        pid = r.json()["id"]
        # member_ids=None => mọi thành viên đang hoạt động, gồm cả thủ quỹ
        self.assertEqual(Invoice.objects.filter(period_id=pid).count(), 2)

        mail.outbox.clear()
        r2 = self.post_json(f"/api/treasurer/periods/{pid}/remind", {})
        self.assertEqual(r2.status_code, 200, r2.content)
        self.assertEqual(r2.json()["sent"], 2)
        self.assertEqual(len(mail.outbox), 2)

        # Throttle: gọi lại ngay bị từ chối
        r3 = self.post_json(f"/api/treasurer/periods/{pid}/remind", {})
        self.assertEqual(r3.status_code, 429)

    def test_update_period_reprices_pending_only(self):
        p = FeePeriod.objects.create(name="T10", amount=50_000, due_date=date.today())
        inv_paid = Invoice.objects.create(member=self.member, period=p, amount=50_000,
                                          status=Invoice.Status.PAID, paid_at=timezone.now())
        other = User.objects.create_user("other@x.vn", full_name="Le B")
        inv_pending = Invoice.objects.create(member=other, period=p, amount=50_000)
        self.post_json(f"/api/treasurer/periods/{p.pk}/update",
                       {"name": "T10 moi", "amount": 60_000, "due_date": str(date.today())})
        inv_paid.refresh_from_db()
        inv_pending.refresh_from_db()
        self.assertEqual(inv_paid.amount, 50_000)   # đã đóng giữ nguyên
        self.assertEqual(inv_pending.amount, 60_000)

    def test_delete_period_with_paid_forbidden(self):
        p = FeePeriod.objects.create(name="T10", amount=50_000, due_date=date.today())
        Invoice.objects.create(member=self.member, period=p, amount=50_000,
                               status=Invoice.Status.PAID, paid_at=timezone.now())
        r = self.post_json(f"/api/treasurer/periods/{p.pk}/delete", {})
        self.assertEqual(r.status_code, 400)
        self.assertTrue(FeePeriod.objects.filter(pk=p.pk).exists())

    def test_csv_export(self):
        p = FeePeriod.objects.create(name="T10", amount=50_000, due_date=date.today())
        Invoice.objects.create(member=self.member, period=p, amount=50_000)
        r = self.c.get(f"/api/treasurer/periods/{p.pk}/csv")
        self.assertEqual(r.status_code, 200)
        self.assertIn("Nguyen Van A", r.content.decode("utf-8"))


class ExpenseTests(TreasurerBase):
    def test_create_list_delete(self):
        r = self.post_json("/api/treasurer/expenses", {
            "amount": 120_000, "reason": "mua đồng hồ", "spent_at": str(date.today())})
        self.assertEqual(r.status_code, 200, r.content)
        eid = r.json()["id"]

        lst = self.c.get("/api/treasurer/expenses").json()
        self.assertEqual(lst["summary"]["spent"], 120_000)

        self.post_json(f"/api/treasurer/expenses/{eid}/delete", {})
        self.assertFalse(Expense.objects.filter(pk=eid).exists())
        self.assertTrue(AuditLog.objects.filter(action="expense.delete").exists())

    def test_zero_amount_rejected(self):
        r = self.post_json("/api/treasurer/expenses", {
            "amount": 0, "reason": "x", "spent_at": str(date.today())})
        self.assertEqual(r.status_code, 400)


class TransactionTests(TreasurerBase):
    def setUp(self):
        super().setUp()
        self.period = FeePeriod.objects.create(name="T10", amount=50_000, due_date=date.today())
        self.invoice = Invoice.objects.create(member=self.member, period=self.period, amount=50_000)

    @override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
    def test_auto_match_by_transfer_code(self):
        tx, created = record_transaction(
            dedupe_key="casso-1", amount=50_000,
            content=f"chuyen tien {self.member.transfer_code} cho quy",
            occurred_at=timezone.now(), source=BankTransaction.Source.CASSO)
        self.assertTrue(created)
        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.status, Invoice.Status.PAID)
        self.assertEqual(tx.status, BankTransaction.Status.MATCHED)

    def test_dedupe_same_key(self):
        t1, c1 = record_transaction(dedupe_key="casso-9", amount=1_000, content="QUYABC123",
                                    occurred_at=timezone.now(), source=BankTransaction.Source.CASSO)
        t2, c2 = record_transaction(dedupe_key="casso-9", amount=1_000, content="QUYABC123",
                                    occurred_at=timezone.now(), source=BankTransaction.Source.CASSO)
        self.assertTrue(c1)
        self.assertFalse(c2)
        self.assertEqual(t1.pk, t2.pk)

    def test_assign_and_history(self):
        tx, _ = record_transaction(dedupe_key="fp-1", amount=60_000, content="khong co ma",
                                   occurred_at=timezone.now(), source=BankTransaction.Source.STATEMENT)
        self.assertEqual(tx.status, BankTransaction.Status.UNMATCHED)

        r = self.post_json(f"/api/treasurer/transactions/{tx.pk}/assign", {"invoice_id": self.invoice.pk})
        self.assertEqual(r.status_code, 200, r.content)
        tx.refresh_from_db()
        self.assertEqual(tx.status, BankTransaction.Status.MATCHED)
        self.assertIn("Thừa tiền", tx.note)

        hist = self.c.get("/api/treasurer/transactions/history?status=matched").json()
        self.assertEqual(len(hist["items"]), 1)
        self.assertEqual(hist["items"][0]["period"], "T10")

        q = self.c.get("/api/treasurer/transactions/history?q=khong+co+ma").json()
        self.assertEqual(len(q["items"]), 1)

    def test_ignore(self):
        tx, _ = record_transaction(dedupe_key="fp-2", amount=99_000, content="roi rac",
                                   occurred_at=timezone.now(), source=BankTransaction.Source.EMAIL)
        self.post_json(f"/api/treasurer/transactions/{tx.pk}/ignore", {})
        tx.refresh_from_db()
        self.assertEqual(tx.status, BankTransaction.Status.IGNORED)

    def test_cash_mark_paid(self):
        r = self.post_json(f"/api/treasurer/invoices/{self.invoice.pk}/cash", {})
        self.assertEqual(r.status_code, 200, r.content)
        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.status, Invoice.Status.PAID)


@override_settings(CASSO_SECURE_KEY="test-key-123", EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class CassoWebhookTests(TestCase):
    def setUp(self):
        self.c = Client()

    def _payload(self, amount=50_000, tx_id=1, content="nap tien"):
        return {"error": 0, "data": {
            "id": tx_id, "reference": f"REF{tx_id}", "description": content, "amount": amount,
            "runningBalance": 0,
            "transactionDateTime": timezone.localtime().strftime("%Y-%m-%d %H:%M:%S"),
            "counterAccountName": "Nguyen Chuyen",
        }}

    def _sign(self, payload, key="test-key-123"):
        def sort_keys(o):
            return {k: sort_keys(o[k]) for k in sorted(o)} if isinstance(o, dict) else o
        t = int(time_mod.time() * 1000)
        body = json.dumps(sort_keys(payload), separators=(",", ":"))
        sig = hmac.new(key.encode(), f"{t}.{body}".encode(), hashlib.sha512).hexdigest()
        return f"t={t},v1={sig}"

    def _post(self, payload, sig):
        return self.c.post("/api/webhooks/casso", data=json.dumps(payload),
                           content_type="application/json",
                           HTTP_X_CASSO_SIGNATURE=sig)

    def test_valid_signature_creates_tx(self):
        p = self._payload(tx_id=777)
        r = self._post(p, self._sign(p))
        self.assertEqual(r.status_code, 200, r.content)
        self.assertTrue(BankTransaction.objects.filter(dedupe_key="casso-777").exists())

    def test_invalid_signature_401(self):
        p = self._payload(tx_id=778)
        r = self._post(p, self._sign(p, key="sai-key"))
        self.assertEqual(r.status_code, 401)
        self.assertFalse(BankTransaction.objects.filter(dedupe_key="casso-778").exists())

    def test_negative_amount_becomes_outflow(self):
        p = self._payload(amount=-200_000, tx_id=779)
        r = self._post(p, self._sign(p))
        self.assertEqual(r.status_code, 200)
        o = BankOutflow.objects.get(dedupe_key="casso-779")
        self.assertEqual(o.amount, 200_000)
        self.assertEqual(o.counterparty, "Nguyen Chuyen")

    def test_duplicate_webhook_idempotent(self):
        p = self._payload(tx_id=780)
        self._post(p, self._sign(p))
        r2 = self._post(p, self._sign(p))
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(BankTransaction.objects.filter(dedupe_key="casso-780").count(), 1)


class RegistrationTests(TreasurerBase):
    def test_register_approve_flow(self):
        r = self.c.post("/api/auth/register", data=json.dumps(
            {"email": "new@x.vn", "full_name": "  Pham   Moi ", "note": "hello"}),
            content_type="application/json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(RegistrationRequest.objects.count(), 1)

        rid = RegistrationRequest.objects.first().pk
        r2 = self.post_json(f"/api/treasurer/registrations/{rid}/approve", {})
        self.assertEqual(r2.status_code, 200, r2.content)
        u = User.objects.get(email="new@x.vn")
        self.assertEqual(u.full_name, "Pham Moi")  # đã chuẩn hóa khoảng trắng

    def test_reject(self):
        RegistrationRequest.objects.create(email="x@x.vn", full_name="X")
        rid = RegistrationRequest.objects.first().pk
        self.post_json(f"/api/treasurer/registrations/{rid}/reject", {})
        self.assertEqual(RegistrationRequest.objects.get(pk=rid).status, "rejected")


class AuditListTests(TreasurerBase):
    def test_list(self):
        AuditLog.objects.create(user=self.treasurer, action="period.create", detail="period=1")
        r = self.c.get("/api/treasurer/audit").json()
        self.assertEqual(len(r["items"]), 1)
        self.assertEqual(r["items"][0]["user"], "Tran Thu Quy")
