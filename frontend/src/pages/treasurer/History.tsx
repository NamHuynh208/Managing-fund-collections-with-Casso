import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { Badge, Card, Empty, Input, PageHeader, Select, Spinner } from "../../components/ui";
import { dt, vnd } from "../../lib/format";

type Item = {
  id: number;
  amount: number;
  content: string;
  occurred_at: string;
  source: string;
  status: string;
  status_display: string;
  member: string | null;
  period: string | null;
  note: string;
};

const STATUS_TONE: Record<string, "ok" | "warn" | "bad" | "mute"> = {
  matched: "ok",
  review: "warn",
  unmatched: "bad",
  ignored: "mute",
};

export default function History() {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery<{ items: Item[] }>({
    queryKey: ["tx-history", status, q],
    queryFn: () => {
      const sp = new URLSearchParams();
      if (status) sp.set("status", status);
      if (q.trim()) sp.set("q", q.trim());
      return api(`/treasurer/transactions/history?${sp}`);
    },
  });

  return (
    <div>
      <PageHeader title="Lịch sử giao dịch" sub="Toàn bộ tiền vào tài khoản quỹ, gồm cả giao dịch đã khớp và đã bỏ qua." />

      <div className="mb-4 flex flex-wrap gap-2">
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto">
          <option value="">Mọi trạng thái</option>
          <option value="matched">Đã khớp</option>
          <option value="review">Cần xem</option>
          <option value="unmatched">Chưa khớp</option>
          <option value="ignored">Đã bỏ qua</option>
        </Select>
        <Input
          placeholder="Tìm theo nội dung chuyển khoản hoặc tên thành viên…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-md flex-1"
        />
      </div>

      {isLoading ? (
        <Spinner />
      ) : !data || data.items.length === 0 ? (
        <Empty>Không có giao dịch nào khớp bộ lọc.</Empty>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Thời điểm</th>
                  <th className="text-right">Số tiền</th>
                  <th>Nội dung</th>
                  <th>Thành viên / Kỳ</th>
                  <th>Nguồn</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((t) => (
                  <tr key={t.id}>
                    <td className="num whitespace-nowrap text-sm">{dt(t.occurred_at)}</td>
                    <td className="num whitespace-nowrap text-right font-bold">{vnd(t.amount)}</td>
                    <td className="mono max-w-72 truncate text-sm" title={t.content}>
                      {t.content || "(trống)"}
                      {t.note && <span className="block font-sans text-xs text-[var(--bad-fg)]">{t.note}</span>}
                    </td>
                    <td className="text-sm">
                      {t.member ?? "—"}
                      {t.period && <span className="block text-xs text-[var(--muted)]">{t.period}</span>}
                    </td>
                    <td className="text-xs uppercase tracking-wide text-[var(--muted)]">{t.source}</td>
                    <td>
                      <Badge tone={STATUS_TONE[t.status] ?? "mute"}>{t.status_display}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
