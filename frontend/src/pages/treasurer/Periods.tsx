import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { vnd } from "../../lib/format";

type Period = { id: number; name: string; amount: number; due_date: string; total: number; paid: number };
// type Overview = { balance: number; collected: number; spent: number; review_count: number };

export default function Periods() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["periods"],
    queryFn: () =>
      api<{ periods: Period[]; summary: { collected: number; spent: number; balance: number } }>(
        "/treasurer/periods"
      ),
  });
  const periods = data?.periods ?? [];
  const ov = data?.summary
    ? { ...data.summary, review_count: 0 }
    : undefined;

  const empty = { name: "", amount: "", due_date: "" };
  const [form, setForm] = useState(empty);

  const create = useMutation({
    mutationFn: () =>
      api("/treasurer/periods", {
        method: "POST",
        body: JSON.stringify({ name: form.name, amount: Number(form.amount), due_date: form.due_date }),
      }),
    onSuccess: () => {
      setForm(empty);
      qc.invalidateQueries({ queryKey: ["periods"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
    },
  });

  return (
    <div className="space-y-4">
      {ov && (
        <div className="border rounded p-3">
          <b>Quỹ hiện có: {vnd(ov.balance)}</b>
          <div className="text-sm opacity-70">
            Đã thu {vnd(ov.collected)} · Đã chi {vnd(ov.spent)}
          </div>
          {ov.review_count > 0 && (
            <Link to="/thu-quy/giao-dich" className="text-sm underline">
              Có {ov.review_count} giao dịch cần xử lý
            </Link>
          )}
        </div>
      )}

      <form
        className="border rounded p-3 space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (confirm("Tạo kỳ thu và hóa đơn cho TẤT CẢ thành viên đang hoạt động?")) create.mutate();
        }}
      >
        <b>Tạo kỳ thu mới</b>
        <input required placeholder="Tên kỳ (ví dụ: Quỹ tháng 10)" className="border rounded p-2 w-full"
               value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input required type="number" min={1000} placeholder="Số tiền mỗi người (VND)" className="border rounded p-2 w-full"
               value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        <input required type="date" className="border rounded p-2 w-full"
               value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
        {create.error && <p className="text-red-600">{create.error.message}</p>}
        <button disabled={create.isPending} className="border rounded px-3 py-2">Tạo kỳ thu</button>
      </form>

      <table className="w-full text-left">
        <thead><tr><th>Kỳ</th><th>Hạn</th><th>Số tiền</th><th>Đã đóng</th></tr></thead>
        <tbody>
          {periods.map((p) => (
            <tr key={p.id} className="border-t">
              <td><Link className="underline" to={`/thu-quy/ky/${p.id}`}>{p.name}</Link></td>
              <td>{new Date(p.due_date).toLocaleDateString("vi-VN")}</td>
              <td>{vnd(p.amount)}</td>
              <td>{p.paid}/{p.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}