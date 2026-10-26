import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, NavLink, Navigate, Outlet } from "react-router-dom";
import { api, post } from "../lib/api";
import { getConfig } from "../lib/config";
import { Spinner } from "./ui";

type NavItem = { to: string; label: string; end?: boolean; badgeKey?: "review" | "pending_reg" };

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Tổng quan",
    items: [{ to: "/thu-quy", label: "Bảng điều khiển", end: true }],
  },
  {
    section: "Thu quỹ",
    items: [
      { to: "/thu-quy/ky", label: "Kỳ thu" },
      { to: "/thu-quy/giao-dich", label: "Giao dịch chờ", badgeKey: "review" },
      { to: "/thu-quy/lich-su", label: "Lịch sử giao dịch" },
    ],
  },
  {
    section: "Quỹ & thành viên",
    items: [
      { to: "/thu-quy/chi-tieu", label: "Khoản chi" },
      { to: "/thu-quy/chuyen-di", label: "Tiền chuyển đi" },
      { to: "/thu-quy/thanh-vien", label: "Thành viên" },
      { to: "/thu-quy/dang-ky", label: "Đơn đăng ký", badgeKey: "pending_reg" },
    ],
  },
  {
    section: "Hệ thống",
    items: [{ to: "/thu-quy/nhat-ky", label: "Nhật ký thao tác" }],
  },
];

/** Khung khu thủ quỹ: sidebar xanh đậm + vùng nội dung. Tự chặn người không phải thủ quỹ. */
export default function TreasurerLayout() {
  const qc = useQueryClient();
  const { data: me, isLoading, error } = useQuery({
    queryKey: ["me"],
    queryFn: () => api<{ full_name: string; role: string }>("/me"),
    retry: false,
  });
  const { data: ov } = useQuery({
    queryKey: ["overview"],
    queryFn: () => api<{ review_count: number }>("/treasurer/overview"),
    refetchInterval: 60_000,
    retry: false,
  });
  const { data: reg } = useQuery({
    queryKey: ["registrations"],
    queryFn: () => api<{ pending: number }>("/treasurer/registrations"),
    refetchInterval: 60_000,
    retry: false,
  });

  if (isLoading) return <Spinner />;
  if (error || !me) return <Navigate to="/login" replace />;
  if (me.role !== "treasurer")
    return (
      <div className="grid min-h-screen place-items-center p-6">
        <div className="max-w-md border border-[var(--border)] bg-white p-8 text-center">
          <p className="font-semibold">Bạn không có quyền truy cập khu thủ quỹ.</p>
          <Link to="/" className="mt-3 inline-block text-sm">← Về trang của tôi</Link>
        </div>
      </div>
    );

  async function logout() {
    await post("/auth/logout");
    qc.clear();
    window.location.href = "/login";
  }

  const badges: Record<string, number> = {
    review: ov?.review_count ?? 0,
    pending_reg: reg?.pending ?? 0,
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-[var(--brand-900)] text-white md:flex">
        <Link to="/" className="flex items-center gap-2.5 border-b border-white/15 px-4 py-4 no-underline text-white">
          <span className="grid h-8 w-8 place-items-center border border-white/70 bg-[var(--brand-700)] text-sm font-black">
            Q
          </span>
          <span className="text-xs font-bold uppercase leading-tight tracking-wide">
            {getConfig().name}
            <span className="block text-[10px] font-medium text-white/60 normal-case">Khu thủ quỹ</span>
          </span>
        </Link>

        <nav className="flex-1 overflow-y-auto py-3">
          {NAV.map((group) => (
            <div key={group.section} className="mb-3">
              <div className="px-4 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">
                {group.section}
              </div>
              {group.items.map((it) => (
                <NavLink
                  key={it.to}
                  to={it.to}
                  end={it.end}
                  className={({ isActive }) =>
                    "flex items-center justify-between gap-2 border-l-[3px] px-4 py-2 text-sm " +
                    (isActive
                      ? "border-white bg-white/15 font-semibold"
                      : "border-transparent text-white/80 hover:bg-white/10 hover:text-white")
                  }
                >
                  <span>{it.label}</span>
                  {it.badgeKey && badges[it.badgeKey] > 0 && (
                    <span className="min-w-5 bg-[var(--brand-200)] px-1.5 text-center text-[11px] font-bold text-[var(--brand-900)]">
                      {badges[it.badgeKey]}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="border-t border-white/15 px-4 py-3 text-xs text-white/70">
          <div className="truncate font-semibold text-white">{me.full_name}</div>
          <div className="mt-2 flex gap-2">
            <Link to="/" className="border border-white/40 px-2 py-1 no-underline text-white hover:bg-white hover:text-[var(--brand-900)]">
              Trang của tôi
            </Link>
            <button onClick={logout} className="border border-white/40 px-2 py-1 hover:bg-white hover:text-[var(--brand-900)]">
              Đăng xuất
            </button>
          </div>
        </div>
      </aside>

      {/* Nội dung */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Nav di động */}
        <div className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--brand-900)] px-3 py-2 md:hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-white">{getConfig().name} · Thủ quỹ</span>
            <button onClick={logout} className="border border-white/50 px-2 py-0.5 text-[11px] font-semibold text-white">
              Thoát
            </button>
          </div>
          <nav className="mt-2 flex gap-1 overflow-x-auto pb-1">
            {NAV.flatMap((g) => g.items).map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.end}
                className={({ isActive }) =>
                  "whitespace-nowrap border px-2.5 py-1 text-xs " +
                  (isActive
                    ? "border-white bg-white font-semibold text-[var(--brand-900)]"
                    : "border-white/30 text-white/85")
                }
              >
                {it.label}
                {it.badgeKey && badges[it.badgeKey] > 0 ? ` (${badges[it.badgeKey]})` : ""}
              </NavLink>
            ))}
          </nav>
        </div>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
