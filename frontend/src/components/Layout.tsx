import type { ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate } from "react-router-dom";
import { api, post } from "../lib/api";
import { getConfig } from "../lib/config";
import { Spinner } from "./ui";

/** Khung trang cho thành viên: thanh tiêu đề xanh đậm + nội dung căn giữa. */
export default function Layout({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const qc = useQueryClient();
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => api<{ full_name: string; role: string }>("/me"),
    retry: false,
  });

  async function logout() {
    await post("/auth/logout");
    qc.clear();
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-[var(--brand-900)] text-white">
        <div className={`mx-auto flex items-center justify-between gap-4 px-4 py-3 ${wide ? "max-w-6xl" : "max-w-3xl"}`}>
          <Link to="/" className="flex items-center gap-2.5 no-underline text-white hover:text-[var(--brand-200)]">
            <span className="grid h-8 w-8 place-items-center border border-white/70 bg-[var(--brand-700)] text-sm font-black">
              Q
            </span>
            <span className="text-sm font-bold tracking-wide uppercase">{getConfig().name}</span>
          </Link>
          {me && (
            <div className="flex items-center gap-3 text-sm">
              <span className="hidden sm:inline text-white/85">{me.full_name}</span>
              <button
                onClick={logout}
                className="border border-white/60 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide hover:bg-white hover:text-[var(--brand-900)]"
              >
                Đăng xuất
              </button>
            </div>
          )}
        </div>
      </header>
      <main className={`mx-auto w-full flex-1 px-4 py-6 ${wide ? "max-w-6xl" : "max-w-3xl"}`}>{children}</main>
      <footer className="border-t border-[var(--border)] py-3 text-center text-xs text-[var(--muted)]">
        {getConfig().name} · Quản lý quỹ minh bạch
      </footer>
    </div>
  );
}

/** Bọc trang cần đăng nhập: chưa có /me thì hiện đang tải hoặc chuyển về login. */
export function Guard({ children, treasurer = false }: { children: ReactNode; treasurer?: boolean }) {
  const { data: me, error, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => api<{ role: string }>("/me"),
    retry: false,
  });
  if (isLoading) return <Spinner />;
  if (error || !me) return <Navigate to="/login" replace />;
  if (treasurer && me.role !== "treasurer")
    return (
      <Layout>
        <div className="border border-[var(--border)] bg-white p-8 text-center">
          <p className="font-semibold">Bạn không có quyền vào trang này.</p>
          <p className="mt-1 text-sm text-[var(--muted)]">Chỉ thủ quỹ mới truy cập được khu vực này.</p>
        </div>
      </Layout>
    );
  return <>{children}</>;
}
