# Frontend — Quỹ CLB

SPA React 19 + Vite + TypeScript + Tailwind 4. Xem [../README.md](../README.md)
cho tổng quan dự án và [../DEPLOY.md](../DEPLOY.md) để deploy.

```bash
npm install
npm run dev       # dev server :5173, proxy /api -> localhost:8000
npm run build     # typecheck + build production vào dist/
```

- `src/lib/config.ts` đọc `/clubconfig.json` (tên CLB, màu thương hiệu) —
  tùy biến bằng cách sửa `public/clubconfig.json`, không cần đụng code.
- Hệ component dùng chung nằm ở `src/components/ui.tsx` (nút, thẻ, badge,
  bảng...); phong cách phẳng, không bo góc, không gradient, tông xanh lá
  (biến CSS `--brand-*` trong `src/index.css`).
