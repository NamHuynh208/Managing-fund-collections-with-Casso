import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { dt, vnd } from "../../lib/format";

type Out = { id: number; amount: number; content: string; counterparty: string; occurred_at: string; note: string };

function Row({ o }: { o: Out }) {
  const qc = useQueryClient();
  const [note, setNote] = useState(o.note);
  const save = useMutation({
    mutationFn: () => api(`/treasurer/outflows/${o.id}/note`, { method: "POST", body: JSON.stringify({ note }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["outflows"] }),
  });
  const dirty = note !== o.note;

  return (
    <div className="border rounded p-3 space-y-2 text-left">
      <div><b>{vnd(o.amount)}</b> · {dt(o.occurred_at)}</div>
      {o.counterparty && <div>Người nhận: {o.counterparty}</div>}
      <div>Nội dung: <i>{o.content || "(trống)"}</i></div>
      <div className="flex gap-2">
        <input className="border rounded p-2 flex-1" placeholder="Ghi chú (ví dụ: mua đồ cho giải đấu)"
               maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="border rounded px-3" disabled={!dirty || save.isPending}
                onClick={() => save.mutate()}>Lưu</button>
      </div>
      {save.error && <p className="text-red-600">{save.error.message}</p>}
      {save.isSuccess && !dirty && <small>Đã lưu</small>}
    </div>
  );
}

export default function Outflows() {
  const { data } = useQuery({
    queryKey: ["outflows"],
    queryFn: () => api<{ total: number; items: Out[] }>("/treasurer/outflows"),
  });
  if (!data) return <p>Đang tải…</p>;
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold text-left">Lịch sử chuyển đi</h1>
      <p className="text-left">Tổng đã chuyển đi: <b>{vnd(data.total)}</b></p>
      {data.items.length === 0 && <p className="text-left">Chưa có giao dịch chuyển đi nào.</p>}
      {data.items.map((o) => <Row key={o.id} o={o} />)}
    </div>
  );
}