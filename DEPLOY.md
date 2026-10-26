# HƯỚNG DẪN TRIỂN KHAI (DEPLOY) — dành cho AI / quản trị viên

Tài liệu này là **bản đồ đầy đủ** để đưa dự án "Quỹ CLB" lên chạy thật. Đọc theo
thứ tự; mọi lệnh đều đã được kiểm chứng. Ngày kiểm chứng lần cuối: 2026-10-26.

---

## 1. Dự án là gì

Web app quản lý quỹ câu lạc bộ (thu hội phí, chi tiêu, đối soát ngân hàng):

| Thành phần | Công nghệ | Vai trò |
|---|---|---|
| `backend/` | Django 5 + django-ninja + PostgreSQL 16 | API, đăng nhập magic-link, đối soát giao dịch, webhook Casso |
| `frontend/` | React 19 + Vite 8 + Tailwind 4 + TypeScript | SPA cho thành viên và thủ quỹ |
| `Caddyfile`, `Dockerfile.web` | Caddy 2 | Phục vụ SPA + reverse proxy `/api`, `/admin`, `/static` |
| `docker-compose.prod.yml` | Docker Compose | Bộ chạy production: db + backend + web (+ cloudflared tùy chọn) |
| `docker-compose.yml` | Docker Compose | Bộ chạy dev (kèm Mailpit xem email giả) |

Luồng tiền vào: ngân hàng → **Casso** (webhook) → tự khớp với hóa đơn theo
`mã chuyển khoản` (QUYxxxxxx) của từng thành viên → email xác nhận.

Trang cho con người:
- `/login`, `/register`, `/auth/verify` — công khai
- `/` — trang thành viên (khoản cần đóng, mã QR VietQR, lịch sử)
- `/thu-quy/*` — khu thủ quỹ (bảng điều khiển, kỳ thu, giao dịch, khoản chi,
  thành viên, đơn đăng ký, nhật ký)
- `/admin/` — Django admin (chỉ siêu quản trị)

Endpoint kỹ thuật: `GET /health` (JSON, kiểm tra DB).

---

## 2. Yêu cầu môi trường

- **Cách 1 (khuyên dùng):** VPS Linux bất kỳ đã cài Docker Engine ≥ 24 +
  Docker Compose v2 (`docker compose`). Không cần Python/Node trên máy chủ.
- **Cách 2 (không Docker):** Python 3.12+, Node 22+, PostgreSQL 16, và một
  web server (Caddy/Nginx) — xem mục 10.
- RAM tối thiểu: 1 GB (đủ cho cả bộ).
- DNS: một tên miền (subdomain) trỏ về VPS hoặc về Cloudflare Tunnel.

---

## 3. Chạy thử nhanh (dev) — xác nhận source nguyên vẹn

```bash
cd quy-clb
docker compose up -d          # db + backend(8000) + mailpit(8025)
cd frontend && npm install && npm run dev   # Vite ở 5173, proxy /api -> 8000
```

Mở http://localhost:5173 (web) và http://localhost:8025 (hộp thư test).
Tạo tài khoản thủ quỹ đầu tiên cho dev:

```bash
docker compose exec backend python manage.py shell -c "
from apps.accounts.models import User
u, created = User.objects.get_or_create(
    email='thuquy@example.com',
    defaults=dict(full_name='Thu Quy', role='treasurer'))
u.is_staff = u.is_superuser = True
u.save()
print('OK', created)
"
```

Chạy toàn bộ test (29 test):

```bash
docker compose run --rm --no-deps backend python manage.py test apps
```

---

## 4. Deploy production bằng Docker (VPS) — CÁCH CHÍNH

### 4.1. Chuẩn bị biến môi trường

```bash
cd quy-clb
cp .env.prod.example .env.prod
nano .env.prod        # điền các giá trị thật
```

Các giá trị bắt buộc phải đổi so với mẫu:

| Biến | Ghi chú |
|---|---|
| `POSTGRES_PASSWORD` + trong `DATABASE_URL` | mật khẩu Postgres mới (2 chỗ phải khớp nhau) |
| `SECRET_KEY` | `python3 -c "import secrets;print(secrets.token_hex(32))"` |
| `ALLOWED_HOSTS` | tên miền thật (thêm `localhost,127.0.0.1` để tiện gỡ rối) |
| `CSRF_TRUSTED_ORIGINS` | `https://ten-mien` (đúng scheme, không có `/` cuối) |
| `FRONTEND_URL` | `https://ten-mien` (dùng trong email magic link) |
| `EMAIL_*` | SMTP thật (Resend/Brevo/Gmail app password) — bắt buộc vì đăng nhập bằng email |
| `BANK_BIN`, `BANK_ACCOUNT_NO`, `BANK_ACCOUNT_NAME` | in trên QR chuyển khoản |
| `CASSO_SECURE_KEY` | nếu dùng Casso (mục 6) |
| `TUNNEL_TOKEN` | nếu dùng Cloudflare Tunnel (mục 7a) |

> ⚠️ Tên biến phải đúng là `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`
> (KHÔNG phải `DJANGO_SECRET_KEY`... — bản cấu hình cũ từng sai tên biến này).

### 4.2. Khởi động

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
docker compose -f docker-compose.prod.yml ps       # chờ cả 3 dịch vụ Up/healthy
curl -s http://127.0.0.1/health                    # mong đợi: {"status": "ok", "db": "connected"}
```

Backend tự chạy `migrate` + `collectstatic` rồi mới khởi động gunicorn
(xem `backend/entrypoint.prod.sh`). Caddy phục vụ ở cổng `WEB_PORT` (mặc định 80).

### 4.3. Tạo thủ quỹ đầu tiên (bắt buộc sau khi deploy)

```bash
docker compose -f docker-compose.prod.yml exec -it backend \
  python manage.py createsuperuser
# nhập email + họ tên; tài khoản này là thủ quỹ + vào được /admin
```

Sau đó vào `https://ten-mien/login`, chọn cổng **Thủ quỹ**, nhập email →
nhận mã 6 số qua email → đăng nhập. Thành viên còn lại tự đăng ký qua
`/register` và thủ quỹ duyệt trong mục **Đơn đăng ký**.

### 4.4. Cập nhật khi có code mới

```bash
cd quy-clb
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
# dữ liệu nằm trong volume pgdata, không mất
```

---

## 5. Kiểm tra sau khi deploy (smoke test)

```bash
curl -s  https://ten-mien/health          # {"status": "ok", "db": "connected"}
curl -sI https://ten-mien/ | head -1      # HTTP/2 200
curl -sI https://ten-mien/admin/login/ | head -1
curl -s  https://ten-mien/thu-quy/nhat-ky | grep -o "<title>.*</title>"
                                          # SPA fallback hoạt động (không 404)
```

Rồi bằng trình duyệt: đăng nhập thủ quỹ → tạo kỳ thu nhỏ (ví dụ 10.000 đ) →
xem trang thành viên có QR → xóa kỳ thu nếu cần.

---

## 6. Đối soát ngân hàng — cấu hình Casso (webhook)

1. Đăng ký Casso (https://casso.vn), liên kết tài khoản ngân hàng của quỹ.
2. Dashboard Casso → **Webhook** → thêm endpoint:
   `https://ten-mien/api/webhooks/casso`
3. Sao chép **Secure Key** vào biến `CASSO_SECURE_KEY` trong `.env.prod`, rồi:
   `docker compose -f docker-compose.prod.yml --env-file .env.prod up -d`
4. Kiểm thử chữ ký từ trong VPS:

```bash
docker compose -f docker-compose.prod.yml exec -e CASSO_SECURE_KEY=$(grep CASSO_SECURE_KEY .env.prod | cut -d= -f2) backend \
  python send_casso_test.py "test khong co ma" 50000 999123
# mong đợi: 200 {"success": true}
```

Giao dịch test sẽ xuất hiện ở trang **Giao dịch chờ** (trạng thái "chưa khớp")
— thủ quỹ bấm **Bỏ qua** để dọn. Tiền vào có mã QUYxxxxxx + đúng số tiền sẽ
tự khớp hóa đơn và gửi email xác nhận.

---

## 7. HTTPS — hai lựa chọn

### 7a. Cloudflare Tunnel (không mở cổng VPS — đang được dùng cho quy.namprojects.site)

1. Cloudflare Zero Trust → Networks → Tunnels → Create tunnel → sao chép
   token vào `TUNNEL_TOKEN` trong `.env.prod`.
2. Public hostname: `ten-mien` → Service: `http://web:80`.
3. Khởi động kèm profile tunnel:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod --profile tunnel up -d
```

Với tunnel: để `SITE_ADDRESS=` trống, `X_FORWARDED_PROTO=https` (mặc định).

### 7b. Caddy trực tiếp (mở cổng 80/443, DNS trỏ thẳng về VPS)

Trong `.env.prod` đặt:

```
SITE_ADDRESS=ten-mien        # Caddy tự xin chứng chỉ Let's Encrypt
WEB_PORT=80
```

Đảm bảo tường lửa mở 80 + 443. Caddy cần ghi dữ liệu vào volume chứng chỉ
(không cần cấu hình thêm — dùng bộ nhớ trong container; muốn giữ chứng chỉ
lâu dài, thêm volume `caddy_data:/data` cho dịch vụ web).

---

## 8. Sao lưu & phục hồi

```bash
# SAO LƯU (nên chạy cron hằng ngày)
docker exec $(docker ps -qf name=quy-prod-db) pg_dump -U quy_app quy | gzip > backup-$(date +%F).sql.gz

# PHỤC HỒI
gunzip -c backup-2026-01-01.sql.gz | \
  docker exec -i $(docker ps -qf name=quy-prod-db) psql -U quy_app quy
```

Volume quan trọng duy nhất: `quy-prod_pgdata` (toàn bộ dữ liệu ứng dụng).

---

## 9. Xử lý sự cố thường gặp

| Triệu chứng | Nguyên nhân / cách xử lý |
|---|---|
| `curl /health` trả `db: down` | db chưa healthy — `docker compose ... logs db` |
| Đăng nhập không nhận được email | Xem `docker compose ... logs backend` khi gửi mã; sai `EMAIL_*`; SPF/DNS của miền gửi |
| Lỗi CSRF (403) khi đăng nhập | `CSRF_TRUSTED_ORIGINS` thiếu/khai báo sai scheme (`https://` bắt buộc khi qua HTTPS) |
| Webhook Casso 401 | Sai `CASSO_SECURE_KEY` (so lại trong dashboard Casso) |
| Webhook Casso 503 | Chưa đặt `CASSO_SECURE_KEY` trong `.env.prod` |
| Vào tên miền bị 502 | backend chưa dậy — `logs backend`; đợi migrate xong |
| Đổi `.env.prod` mà không hiệu lực | Phải `up -d` lại (recreate), không dùng `restart` |
| Quên mật khẩu admin | Magic link qua email là đường đăng nhập chính; hoặc `createsuperuser` tài khoản mới |
| Trang trắng sau deploy | Xem `logs web`; build frontend fail sẽ hiện ở bước `up -d --build` |

---

## 10. Deploy KHÔNG dùng Docker (tham khảo)

```bash
# Backend
cd backend
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL=postgres://quy_app:MK@localhost:5432/quy   # hoặc sqlite cho thử
export SECRET_KEY=... DEBUG=False ALLOWED_HOSTS=... CSRF_TRUSTED_ORIGINS=...
python manage.py migrate && python manage.py collectstatic
gunicorn config.wsgi:application --bind 127.0.0.1:8000 --workers 2

# Frontend
cd frontend && npm ci && npm run build    # xuất ra dist/

# Web server: trỏ /api, /admin, /static -> 127.0.0.1:8000
#             còn lại phục vụ từ dist/ với fallback /index.html
```

(Frontend dev proxy cấu hình trong `frontend/vite.config.ts`.)

---

## 11. Cấu trúc thư mục (bản đồ nhanh cho AI)

```
quy-clb/
├── DEPLOY.md                  <- file này
├── README.md                  <- giới thiệu dự án
├── docker-compose.yml         <- dev
├── docker-compose.prod.yml    <- production
├── Dockerfile.web             <- build frontend + Caddy (2 giai đoạn)
├── Caddyfile                  <- web server (env-configurable)
├── .env                       <- biến dev (không bí mật quan trọng)
├── .env.example               <- mẫu dev
├── .env.prod                  <- biến production (BÍ MẬT, không đưa lên Git)
├── .env.prod.example          <- mẫu production
├── scripts/package.ps1        <- tạo zip bàn giao sạch (Windows)
├── backend/
│   ├── Dockerfile, entrypoint.prod.sh, .dockerignore
│   ├── requirements.txt, manage.py, db.sqlite3 (chỉ dev)
│   ├── config/settings.py     <- đọc mọi biến từ env (django-environ)
│   ├── apps/accounts/         <- User (email đăng nhập, transfer_code), LoginToken, RegistrationRequest
│   ├── apps/funds/            <- FeePeriod, Invoice, Expense, AuditLog, VietQR, dịch vụ
│   ├── apps/payments/         <- BankTransaction, BankOutflow, đối soát, nhập sao kê CSV, lọc email IMAP
│   └── apps/api/              <- REST (ninja): api.py, treasurer.py, extra.py, casso.py (webhook), tests.py
└── frontend/
    ├── src/lib/               <- api.ts (fetch+CSRF), config.ts (clubconfig.json), format.ts
    ├── src/components/        <- ui.tsx (hệ component), Layout, TreasurerLayout, MemberPicker, CopyButton
    └── src/pages/             <- Login/Verify/Register/Home/NotFound + treasurer/* (9 trang)
```

Biến môi trường đầy đủ: xem `.env.prod.example` (mỗi biến đều có chú thích).

Tùy biến thương hiệu: sửa `frontend/public/clubconfig.json` (tên CLB, màu
chủ đạo) rồi build lại — không cần đụng code.

---

## 12. Checklist bàn giao

- [ ] `.env.prod` đã điền đủ và `docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build` chạy sạch
- [ ] `/health` trả `{"status": "ok", "db": "connected"}`
- [ ] Tạo được thủ quỹ đầu tiên (`createsuperuser`) và đăng nhập bằng mã email
- [ ] Email gửi đến hộp thư thật (kiểm tra logs backend không có lỗi SMTP)
- [ ] QR chuyển khoản hiện đúng số TK + tên + số tiền + mã nội dung
- [ ] Casso webhook trả 200 với test có chữ ký (mục 6)
- [ ] HTTPS hoạt động (tunnel hoặc Caddy direct)
- [ ] Cron backup `pg_dump` đã đặt
- [ ] Đã xóa/đổi các mật khẩu mẫu nếu từng đưa zip cho ai đó
