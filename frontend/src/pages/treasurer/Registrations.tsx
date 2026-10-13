import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { dt } from "../../lib/format";

type Reg = { id: number; full_name: string; email: string; note: string; created_at: string };

export default function Registrations() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["registrations"],
    queryFn: () => api<{ pending: number; items: Reg[] }>("/treasurer/registrations"),
  });

  const act = useMutation({
    mutationFn: ({ id, kind }: { id: number; kind: "approve" | "reject" }) =>
      api(`/treasurer/registrations/${id}/${kind}`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["registrations"] });
      qc.invalidateQueries({ queryKey: ["members"] });
    },
  });

  if (!data) return <p>Đang tải…</p>;
  return (
    <div className="space-y-3 text-left">
      <h1 className="text-xl font-semibold">Đơn đăng ký thành viên</h1>
      {act.error && <p className="text-red-600">{act.error.message}</p>}
      {data.items.length === 0 && <p>Không có đơn nào đang chờ duyệt.</p>}
      {data.items.map((r) => (
        <div key={r.id} className="border rounded p-3 space-y-2">
          <div><b>{r.full_name}</b> · {r.email}</div>
          <small className="block">Gửi lúc {dt(r.created_at)}</small>
          {r.note && <div>Ghi chú: <i>{r.note}</i></div>}
          <div className="flex gap-3">
            <button className="border rounded px-3 py-1" disabled={act.isPending}
                    onClick={() => act.mutate({ id: r.id, kind: "approve" })}>Duyệt</button>
            <button className="underline" disabled={act.isPending}
                    onClick={() => act.mutate({ id: r.id, kind: "reject" })}>Từ chối</button>
          </div>
        </div>
      ))}
    </div>
  );
}