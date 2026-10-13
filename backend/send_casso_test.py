import hashlib, hmac, json, os, sys, time, urllib.request, urllib.error
from datetime import datetime, timedelta, timezone

key = os.environ["CASSO_SECURE_KEY"]
host = os.environ["DJANGO_ALLOWED_HOSTS"].split(",")[0].strip()
content = sys.argv[1] if len(sys.argv) > 1 else "test khong co ma"
amount = int(sys.argv[2]) if len(sys.argv) > 2 else 50000
tx_id = int(sys.argv[3]) if len(sys.argv) > 3 else int(time.time())

now_vn = datetime.now(timezone(timedelta(hours=7))).strftime("%Y-%m-%d %H:%M:%S")
payload = {"error": 0, "data": {
    "id": tx_id, "reference": f"TEST{tx_id}", "description": content, "amount": amount,
    "runningBalance": 1000000, "transactionDateTime": now_vn, "accountNumber": "000",
    "bankName": "Vietcombank", "bankAbbreviation": "VCB",
    "virtualAccountNumber": "", "virtualAccountName": "",
    "counterAccountName": "", "counterAccountNumber": "",
    "counterAccountBankId": "", "counterAccountBankName": ""}}

def sort_keys(o):
    return {k: sort_keys(o[k]) for k in sorted(o)} if isinstance(o, dict) else o

t = int(time.time() * 1000)
msg = f"{t}." + json.dumps(sort_keys(payload), separators=(",", ":"))
sig = hmac.new(key.encode(), msg.encode(), hashlib.sha512).hexdigest()

req = urllib.request.Request(
    "http://localhost:8000/api/webhooks/casso",
    data=json.dumps(payload).encode(), method="POST",
    headers={"Content-Type": "application/json", "Host": host,
             "X-Forwarded-Proto": "https", "X-Casso-Signature": f"t={t},v1={sig}"})
try:
    r = urllib.request.urlopen(req, timeout=10)
    print(r.status, r.read().decode())
except urllib.error.HTTPError as e:
    print(e.code, e.read().decode())