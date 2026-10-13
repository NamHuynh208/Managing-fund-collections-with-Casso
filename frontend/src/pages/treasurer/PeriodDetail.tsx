import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { vnd } from "../../lib/format";

type Detail = {
  id: number; name: string; amount: number; due_date: string;
  invoices: { id: number; member: string; email: string; status: string; paid_at: string | null }[];
};

const send = (path: string, body?: unknown) =>
  api(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });

export default function PeriodDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["period", id],
    queryFn: () => api<Detail>(`/treasurer/periods/${id}`),
  });

  const [form, setForm] = useState({ name: "", amount: "", due_date: "" });
  useEffect(() => {
    if (data) setForm({ name: data.name, amount: String(data.amount), due_date: data.due_date });
  }, [data?.id]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["period", id] });
    qc.invalidateQueries({ queryKey: ["periods"] });
    qc.invalidateQueries({ queryKey: ["overview"] });
  };

  const update = useMutation({
    mutationFn: () =>
      send(`/treasurer/periods/${id}/update`, {
        name: form.name, amount: Number(form.amount), due_date: form.due_date,
      }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: () => send(`/treasurer/periods/${id}/delete`),
    onSuccess: () => {
      qc.removeQueries({ queryKey: ["period", id] });
      qc.invalidateQueries({ queryKey: ["periods"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
      nav("/thu-quy");
    },
  });
  const cash = useMutation({
    mutationFn: (invoiceId: number) => send(`/treasurer/invoices/${invoiceId}/cash`),
    onSuccess: refresh,
  });
  const cancel = useMutation({
    mutationFn: (invoiceId: number) => send(`/treasurer/invoices/${invoiceId}/cancel`),
    onSuccess: refresh,
  });

  if (!data) return <p>Đang tải…</p>;

  const paidCount = data.invoices.filter((i) => i.status === "paid").length;
  const err = update.error?.message || remove.error?.message || cash.error?.message || cancel.error?.message;

  return (
    <div className="space-y-4 text-left">
      <Link to="/thu-quy" className="underline">← Quay lại</Link>
      <h1 className="text-xl font-semibold">{data.name}</h1>

      <form
        className="border rounded p-3 space-y-2"
        onSubmit={(e) => { e.preventDefault(); update.mutate(); }}
      >
        <b>Sửa kỳ thu</b>
        <input required className="border rounded p-2 w-full" placeholder="Tên kỳ"
               value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input required type="number" min={1000} className="border rounded p-2 w-full" placeholder="Số tiền mỗi người (VND)"
               value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        <input required type="date" className="border rounded p-2 w-full"
               value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
        <small className="block">
          Đổi số tiền thì chỉ các hóa đơn chưa đóng đổi theo, hóa đơn đã đóng giữ nguyên.
        </small>
        <div className="flex gap-3 items-center">
          <button disabled={update.isPending} className="border rounded px-3 py-2">
            {update.isPending ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
          {update.isSuccess && <small>Đã lưu</small>}
        </div>
      </form>

      <div className="border rounded p-3 space-y-2">
        <b>Xóa kỳ thu</b>
        {paidCount > 0 ? (
          <p className="text-red-600">
            Đã có {paidCount} người đóng nên không thể xóa kỳ này.
          </p>
        ) : (
          <p>Xóa kỳ và toàn bộ hóa đơn chưa đóng của kỳ. Không thể hoàn tác.</p>
        )}
        <button
          disabled={paidCount > 0 || remove.isPending}
          onClick={() => remove.mutate()}
          className="border rounded px-3 py-2"
        >
          {remove.isPending ? "Đang xóa..." : "Xóa kỳ thu"}
        </button>
      </div>

      {err && <p className="text-red-600">{err}</p>}

      <p>Hạn {new Date(data.due_date).toLocaleDateString("vi-VN")} · {vnd(data.amount)} / người</p>
      <table className="w-full text-left">
        <thead><tr><th>Thành viên</th><th>Trạng thái</th><th></th></tr></thead>
        <tbody>
          {data.invoices.map((i) => (
            <tr key={i.id} className="border-t">
              <td>{i.member}</td>
              <td className={i.status === "pending" ? "text-red-600" : "font-semibold"}>
                {i.status === "paid" ? "Đã đóng" : i.status === "pending" ? "Chưa đóng" : "Đã hủy"}
              </td>
              <td className="space-x-3">
                {i.status === "pending" && (
                  <>
                    <button className="underline" disabled={cash.isPending} onClick={() => cash.mutate(i.id)}>
                      Đã nhận tiền mặt
                    </button>
                    <button className="underline" disabled={cancel.isPending} onClick={() => cancel.mutate(i.id)}>
                      Hủy hóa đơn
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}