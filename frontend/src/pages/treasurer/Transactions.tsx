import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { dt, vnd } from "../../lib/format";

type Tx = {
  id: number; amount: number; content: string; occurred_at: string; source: string;
  note: string; member: string | null;
};
type Pending = { id: number; member: string; period: string; amount: number };

function TxCard({ tx, pending, onDone }: { tx: Tx; pending: Pending[]; onDone: () => void }) {
  const [invoice, setInvoice] = useState("");

  // Đưa hóa đơn của đúng người (nếu hệ thống nhận ra) lên đầu danh sách
    const sorted = [...pending].sort(
    (a, b) => Number(b.member === tx.member) - Number(a.member === tx.member)
  );

  const assign = useMutation({
    mutationFn: () =>
      api(`/treasurer/transactions/${tx.id}/assign`, {
        method: "POST",
        body: JSON.stringify({ invoice_id: Number(invoice) }),
      }),
    onSuccess: onDone,
  });
  const ignore = useMutation({
    mutationFn: () => api(`/treasurer/transactions/${tx.id}/ignore`, { method: "POST" }),
    onSuccess: onDone,
  });

  return (
    <div className="border rounded p-3 space-y-2">
      <div><b>{vnd(tx.amount)}</b> · {dt(tx.occurred_at)} · {tx.source}</div>
      <div>Nội dung: <i>{tx.content}</i></div>
      {tx.member && <div>Hệ thống đoán là: {tx.member}</div>}
      {tx.note && <div className="text-red-600 text-sm">{tx.note}</div>}
      <div className="flex gap-2 flex-wrap">
        <select value={invoice} onChange={(e) => setInvoice(e.target.value)} className="border rounded p-2">
          <option value="">— Gán cho hóa đơn —</option>
          {sorted.map((i) => (
            <option key={i.id} value={i.id}>{i.member} · {i.period} · {vnd(i.amount)}</option>
          ))}
        </select>
        <button disabled={!invoice || assign.isPending} onClick={() => assign.mutate()}
                className="border rounded px-3">Gán</button>
        <button className="underline"
                onClick={() => confirm("Bỏ qua giao dịch này?") && ignore.mutate()}>Bỏ qua</button>
      </div>
      {assign.error && <p className="text-red-600">{assign.error.message}</p>}
    </div>
  );
}

export default function Transactions() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["tx"],
    queryFn: () => api<{ transactions: Tx[]; pending_invoices: Pending[] }>("/treasurer/transactions"),
    refetchInterval: 30_000,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["tx"] });
    qc.invalidateQueries({ queryKey: ["overview"] });
    qc.invalidateQueries({ queryKey: ["periods"] });
  };

  if (!data) return <p>Đang tải…</p>;
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">Giao dịch cần xử lý</h1>
      {data.transactions.length === 0 && <p className="text-green-700">Không có giao dịch nào cần xử lý.</p>}
      {data.transactions.map((t) => (
        <TxCard key={t.id} tx={t} pending={data.pending_invoices} onDone={refresh} />
      ))}
    </div>
  );
}