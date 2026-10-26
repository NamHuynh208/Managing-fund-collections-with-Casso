# Quỹ CLB — Quản lý quỹ câu lạc bộ

Web app quản lý quỹ CLB: thu hội phí theo kỳ, sinh mã QR chuyển khoản riêng cho
từng thành viên, tự động đối soát tiền vào qua **Casso webhook**, ghi khoản chi,
duyệt thành viên mới và ghi nhật ký mọi thao tác.

Giao diện tiếng Việt, thiết kế phẳng sắc cạnh (không bo góc, không gradient),
tông xanh lá. Không có mật khẩu: đăng nhập bằng liên kết/mã 6 số gửi qua email.

## Tính năng

**Thành viên** — xem khoản cần đóng kèm mã QR VietQR (đúng số tiền + mã nội dung
riêng), sao chép thông tin chuyển khoản nhanh, lịch sử đã đóng, nhận email xác
nhận khi tiền về.

**Thủ quỹ** — bảng điều khiển thu/chi theo tháng; tạo/sửa/xóa kỳ thu (chọn cả
hay từng thành viên); gửi nhắc email những người chưa đóng; xuất CSV; ghi nhận
tiền mặt; xử lý giao dịch không khớp (gán tay/bỏ qua); lịch sử toàn bộ giao dịch
có lọc + tìm kiếm; khoản chi và tiền chuyển đi; quản lý thành viên (vai trò,
khóa/mở, xem mã chuyển khoản); duyệt đơn đăng ký; nhật ký thao tác.

**Tự động** — webhook Casso (chữ ký HMAC-SHA512) tự khớp tiền vào theo mã
chuyển khoản; chống trùng giao dịch; email xác nhận; chống spam yêu cầu đăng nhập.

## Chạy thử trong 5 phút (dev)

```bash
docker compose up -d                                  # db + backend + mailpit
cd frontend && npm install && npm run dev             # web tại :5173
# hộp thư test: http://localhost:8025
```

Deploy production (VPS/Docker): xem **[DEPLOY.md](DEPLOY.md)**.

## Kiểm thử

```bash
docker compose run --rm --no-deps backend python manage.py test apps   # 29 test
cd frontend && npm run build                                            # build + typecheck
```

## Công nghệ

Django 5 · django-ninja · PostgreSQL 16 · React 19 · Vite · Tailwind 4 ·
TypeScript · TanStack Query · Caddy 2 · Docker Compose.

## Bố cục

Xem mục 11 trong [DEPLOY.md](DEPLOY.md) để có bản đồ thư mục chi tiết và ý
nghĩa từng ứng dụng Django.
