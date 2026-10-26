import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-[var(--bg)] p-6 text-center">
      <div>
        <p className="text-5xl font-black text-[var(--brand-700)]">404</p>
        <p className="mt-2 text-[var(--muted)]">Không tìm thấy trang này.</p>
        <Link to="/" className="mt-4 inline-block">
          ← Về trang chủ
        </Link>
      </div>
    </div>
  );
}
