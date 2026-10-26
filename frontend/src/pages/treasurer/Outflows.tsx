import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { Button, Card, Empty, PageHeader, Spinner, StatCard } from "../../components/ui";
import { dt, vnd } from "../../lib/format";

type Out = { id: number; amount: number; content: string; counterparty: string; occurred_at: string; note: string };

function Row({ o }: { o: Out }) {
  const qc = useQueryClient();
  const [note, setNote] = useState(o.note);
  const save = useMutation({
    mutationFn: () =>
      api(`/treasurer/outflows/${o.id}/note`, { method: "POST", body: JSON.stringify({ note }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["outflows"] }),
  });
  const dirty = note !== o.note;

  return (
    <Card className="px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="num text-lg font-bold">{vnd(o.amount)}</span>
        <span className="text-xs uppercase tracking-wide text-[var(--muted)]">{dt(o.occurred_at)}</span>
      </div>
      {o.counterparty && (
        <p className="mt-1 text-sm">
          Người nhận: <b>{o.counterparty}</b>
        </p>
      )}
      <p className="mono mt-2 border border-[var(--border)] bg-[var(--brand-50)] px-2.5 py-1.5 text-sm">
        {o.content || "(trống)"}
      </p>
      <div className="mt-3 flex gap-2">
        <input
          className="flex-1"
          placeholder="Ghi chú (ví dụ: mua đồ cho giải đấu)"
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <Button variant={dirty ? "primary" : "outline"} disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
          Lưu ghi chú
        </Button>
      </div>
      {save.isSuccess && !dirty && <p className="mt-1 text-xs text-[var(--brand-700)]">Đã lưu</p>}
    </Card>
  );
}

export default function Outflows() {
  const { data, isLoading } = useQuery<{ total: number; items: Out[] }>({
    queryKey: ["outflows"],
    queryFn: () => api("/treasurer/outflows"),
  });
  if (isLoading) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Tiền chuyển đi"
        sub="Giao dịch tiền RA khỏi tài khoản quỹ (Casso gửi về). Khoản chi nội bộ quỹ hãy ghi ở trang Khoản chi."
      />
      <div className="mb-4">
        <StatCard label="Tổng đã chuyển đi" value={vnd(data?.total ?? 0)} hint={`${data?.items.length ?? 0} giao dịch gần nhất`} tone="warn" />
      </div>
      {!data || data.items.length === 0 ? (
        <Empty>Chưa có giao dịch chuyển đi nào.</Empty>
      ) : (
        <div className="space-y-3">
          {data.items.map((o) => (
            <Row key={o.id} o={o} />
          ))}
        </div>
      )}
    </div>
  );
}
