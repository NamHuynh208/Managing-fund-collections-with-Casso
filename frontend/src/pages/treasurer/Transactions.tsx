import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { Badge, Button, Card, Empty, ErrorText, PageHeader, Select, Spinner } from "../../components/ui";
import { dt, vnd } from "../../lib/format";

type Tx = {
  id: number;
  amount: number;
  content: string;
  occurred_at: string;
  source: string;
  note: string;
  member: string | null;
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
    <Card className="p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="num text-lg font-bold">{vnd(tx.amount)}</span>
        <span className="text-xs uppercase tracking-wide text-[var(--muted)]">
          {tx.source} · {dt(tx.occurred_at)}
        </span>
      </div>
      <p className="mono mt-2 border border-[var(--border)] bg-[var(--brand-50)] px-2.5 py-1.5 text-sm">
        {tx.content || "(trống)"}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        {tx.member && (
          <Badge tone="brand">Hệ thống đoán: {tx.member}</Badge>
        )}
        {tx.note && <Badge tone="bad">{tx.note}</Badge>}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Select value={invoice} onChange={(e) => setInvoice(e.target.value)} className="w-auto min-w-56 flex-1">
          <option value="">— Gán cho hóa đơn —</option>
          {sorted.map((i) => (
            <option key={i.id} value={i.id}>
              {i.member} · {i.period} · {vnd(i.amount)}
            </option>
          ))}
        </Select>
        <Button disabled={!invoice || assign.isPending} onClick={() => assign.mutate()}>
          {assign.isPending ? "Đang gán…" : "Gán"}
        </Button>
        <Button variant="ghost" disabled={ignore.isPending} onClick={() => ignore.mutate()}>
          Bỏ qua
        </Button>
      </div>
      <ErrorText>{assign.error?.message}</ErrorText>
    </Card>
  );
}

export default function Transactions() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ transactions: Tx[]; pending_invoices: Pending[] }>({
    queryKey: ["tx"],
    queryFn: () => api("/treasurer/transactions"),
    refetchInterval: 30_000,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["tx"] });
    qc.invalidateQueries({ queryKey: ["overview"] });
    qc.invalidateQueries({ queryKey: ["periods"] });
  };

  if (isLoading) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Giao dịch chờ xử lý"
        sub="Tiền đã vào tài khoản nhưng chưa khớp tự động với hóa đơn nào. Trang tự làm mới mỗi 30 giây."
      />
      {!data || data.transactions.length === 0 ? (
        <Empty>✓ Không có giao dịch nào cần xử lý. Mọi khoản đã được đối soát tự động.</Empty>
      ) : (
        <div className="space-y-3">
          {data.transactions.map((t) => (
            <TxCard key={t.id} tx={t} pending={data.pending_invoices} onDone={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}
