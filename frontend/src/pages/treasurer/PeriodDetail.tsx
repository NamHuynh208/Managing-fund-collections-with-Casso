import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { vnd } from "../../lib/format";

type Detail = {
  id: number; name: string; amount: number; due_date: string;
  invoices: { id: number; member: string; email: string; status: string; paid_at: string | null }[];
};

export default function PeriodDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["period", id],
    queryFn: () => api<Detail>(`/treasurer/periods/${id}`),
  });

  const cash = useMutation({
    mutationFn: (invoiceId: number) => api(`/treasurer/invoices/${invoiceId}/cash`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["period", id] });
      qc.invalidateQueries({ queryKey: ["periods"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
    },
  });

  if (!data) return <p>Đang tải…</p>;
  return (
    <div className="space-y-3">
      <Link to="/thu-quy" className="underline">← Quay lại</Link>
      <h1 className="text-xl font-semibold">{data.name}</h1>
      <p>Hạn {new Date(data.due_date).toLocaleDateString("vi-VN")} · {vnd(data.amount)} / người</p>
      <table className="w-full text-left">
        <thead><tr><th>Thành viên</th><th>Trạng thái</th><th></th></tr></thead>
        <tbody>
          {data.invoices.map((i) => (
            <tr key={i.id} className="border-t">
              <td>{i.member}</td>
              <td className={i.status === "paid" ? "text-green-700" : "text-red-600"}>
                {i.status === "paid" ? "Đã đóng" : i.status === "pending" ? "Chưa đóng" : "Đã hủy"}
              </td>
              <td>
                {i.status === "pending" && (
                  <button className="underline"
                    onClick={() => confirm(`Xác nhận ${i.member} đã đưa tiền mặt?`) && cash.mutate(i.id)}>
                    Đã nhận tiền mặt
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}