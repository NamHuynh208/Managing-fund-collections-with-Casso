import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";

export default function Register() {
  const [form, setForm] = useState({ full_name: "", email: "", note: "" });
  const send = useMutation({
    mutationFn: () => api("/auth/register", { method: "POST", body: JSON.stringify(form) }),
  });

  if (send.isSuccess) {
    return (
      <main className="mx-auto max-w-md p-4 space-y-3">
        <h1 className="text-2xl font-semibold">Đã gửi đơn đăng ký</h1>
        <p>
          Nếu email của bạn chưa có trong danh sách, đơn đã được gửi cho thủ quỹ xem xét.
          Khi được duyệt, bạn sẽ nhận email và đăng nhập được bằng email này.
        </p>
        <p>Nếu bạn đã là thành viên, hãy <Link to="/login" className="underline">đăng nhập</Link>.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md p-4 space-y-3">
      <h1 className="text-2xl font-semibold">Đăng ký thành viên</h1>
      <form
        className="border rounded p-3 space-y-3 text-left"
        onSubmit={(e) => { e.preventDefault(); send.mutate(); }}
      >
        <input required className="border rounded p-2 w-full" placeholder="Họ và tên"
               value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        <input required type="email" className="border rounded p-2 w-full" placeholder="Email (dùng để đăng nhập)"
               value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input className="border rounded p-2 w-full" placeholder="Ghi chú cho thủ quỹ (không bắt buộc)" maxLength={300}
               value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        {send.error && <p className="text-red-600">{send.error.message}</p>}
        <button disabled={send.isPending} className="border rounded px-3 py-2">
          {send.isPending ? "Đang gửi..." : "Gửi đơn đăng ký"}
        </button>
      </form>
      <p><Link to="/login" className="underline">← Quay lại đăng nhập</Link></p>
    </main>
  );
}