import { useQuery } from "@tanstack/react-query";
import { Navigate, NavLink, Outlet } from "react-router-dom";
import { api } from "../lib/api";

export default function TreasurerGuard() {
  const { data: me, isLoading, error } = useQuery({
    queryKey: ["me"],
    queryFn: () => api<{ role: string }>("/me"),
    retry: false,
  });
  const { data: reg } = useQuery({
  queryKey: ["registrations"],
  queryFn: () => api<{ pending: number }>("/treasurer/registrations"),
  refetchInterval: 60_000,
  retry: false,
});

  if (isLoading) return <p className="p-4">Đang tải…</p>;
  if (error) return <Navigate to="/login" replace />;
  if (me?.role !== "treasurer") return <p className="p-4">Bạn không có quyền truy cập trang này.</p>;

  const link = ({ isActive }: { isActive: boolean }) =>
    "px-3 py-1 " + (isActive ? "font-bold underline" : "");

  return (
    <div className="max-w-3xl mx-auto p-4">
      <nav className="flex gap-2 flex-wrap mb-4 border-b pb-2">
        <NavLink to="/" className={link}>← Trang của tôi</NavLink>
        <NavLink to="/thu-quy" end className={link}>Kỳ thu</NavLink>
        <NavLink to="/thu-quy/giao-dich" className={link}>Giao dịch</NavLink>
        <NavLink to="/thu-quy/dang-ky" className={link}>
          Đơn đăng ký{reg && reg.pending > 0 ? ` (${reg.pending})` : ""}
        </NavLink>
        <NavLink to="/thu-quy/chuyen-di" className={link}>Chuyển đi</NavLink>
      </nav>
      <Outlet />
    </div>
  );
}