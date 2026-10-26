import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { Button, Card, CardHeader, Empty, ErrorText, Field, Input, PageHeader, Spinner, StatCard } from "../../components/ui";
import { vnd } from "../../lib/format";

type Expense = { id: number; amount: number; reason: string; spent_at: string };
type Summary = { collected: number; spent: number; balance: number };

export default function Expenses() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ items: Expense[]; summary: Summary }>({
    queryKey: ["expenses"],
    queryFn: () => api("/treasurer/expenses"),
  });

  const empty = { amount: "", reason: "", spent_at: new Date().toISOString().slice(0, 10) };
  const [form, setForm] = useState(empty);
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const create = useMutation({
    mutationFn: () =>
      api("/treasurer/expenses", {
        method: "POST",
        body: JSON.stringify({
          amount: Number(form.amount),
          reason: form.reason,
          spent_at: form.spent_at,
        }),
      }),
    onSuccess: () => {
      setForm({ ...empty });
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => api(`/treasurer/expenses/${id}/delete`, { method: "POST" }),
    onSuccess: () => {
      setConfirmId(null);
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
    },
  });

  const summary = data?.summary;

  return (
    <div>
      <PageHeader title="Khoản chi" sub="Ghi nhận tiền quỹ đã chi tiêu để số dư luôn chính xác." />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard label="Đã thu" value={vnd(summary?.collected ?? 0)} tone="ok" />
        <StatCard label="Đã chi" value={vnd(summary?.spent ?? 0)} tone="warn" />
        <StatCard label="Còn lại" value={vnd(summary?.balance ?? 0)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_3fr]">
        <Card>
          <CardHeader title="Ghi khoản chi" />
          <form
            className="space-y-4 px-5 py-5"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
          >
            <Field label="Số tiền (VND)">
              <Input
                required
                type="number"
                min={1000}
                step={1000}
                placeholder="150000"
                className="num"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </Field>
            <Field label="Lý do chi">
              <Input
                required
                maxLength={255}
                placeholder="Ví dụ: mua cờ và đồng hồ cho giải đấu"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              />
            </Field>
            <Field label="Ngày chi">
              <Input
                required
                type="date"
                value={form.spent_at}
                onChange={(e) => setForm({ ...form, spent_at: e.target.value })}
              />
            </Field>
            <ErrorText>{create.error?.message}</ErrorText>
            <Button type="submit" disabled={create.isPending} className="w-full">
              {create.isPending ? "Đang lưu…" : "Ghi khoản chi"}
            </Button>
          </form>
        </Card>

        <div>
          {isLoading ? (
            <Spinner />
          ) : !data || data.items.length === 0 ? (
            <Empty>Chưa ghi nhận khoản chi nào.</Empty>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Ngày</th>
                      <th>Lý do</th>
                      <th className="text-right">Số tiền</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((e) => (
                      <tr key={e.id}>
                        <td className="num whitespace-nowrap">{new Date(e.spent_at).toLocaleDateString("vi-VN")}</td>
                        <td>{e.reason}</td>
                        <td className="num text-right font-bold">{vnd(e.amount)}</td>
                        <td className="text-right">
                          {confirmId === e.id ? (
                            <span className="inline-flex gap-2 text-sm">
                              <button
                                className="font-bold text-[var(--bad-fg)] underline"
                                disabled={remove.isPending}
                                onClick={() => remove.mutate(e.id)}
                              >
                                Xóa thật
                              </button>
                              <button className="underline" onClick={() => setConfirmId(null)}>
                                Thôi
                              </button>
                            </span>
                          ) : (
                            <button className="text-sm text-[var(--bad-fg)] underline" onClick={() => setConfirmId(e.id)}>
                              Xóa
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="border-t border-[var(--border)] px-5 py-2.5 text-xs text-[var(--muted)]">
                Tổng {data.items.length} khoản · {vnd(summary?.spent ?? 0)}
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
