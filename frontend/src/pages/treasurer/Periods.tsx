import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import MemberPicker from "../../components/MemberPicker";

type Member = { id: number; full_name: string; email: string; is_active?: boolean };
import { Button, Card, CardHeader, Empty, ErrorText, Field, Input, PageHeader, Spinner } from "../../components/ui";
import { vnd } from "../../lib/format";

type Period = { id: number; name: string; amount: number; due_date: string; total: number; paid: number };

export default function Periods() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ periods: Period[] }>({
    queryKey: ["periods"],
    queryFn: () => api("/treasurer/periods"),
  });
  const { data: mem } = useQuery<{ members: Member[] }>({
    queryKey: ["members"],
    queryFn: () => api("/treasurer/members"),
  });

  const periods = data?.periods ?? [];
  const members = (mem?.members ?? []).filter((m) => m.is_active !== false);

  const empty = { name: "", amount: "", due_date: "" };
  const [form, setForm] = useState(empty);
  const [mode, setMode] = useState<"all" | "some">("all");
  const [selected, setSelected] = useState<number[]>([]);
  const [err, setErr] = useState("");

  const create = useMutation({
    mutationFn: () =>
      api("/treasurer/periods", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          amount: Number(form.amount),
          due_date: form.due_date,
          member_ids: mode === "all" ? null : selected,
        }),
      }),
    onSuccess: () => {
      setForm(empty);
      setMode("all");
      setSelected([]);
      qc.invalidateQueries({ queryKey: ["periods"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
    },
  });

  return (
    <div>
      <PageHeader title="Kỳ thu" sub="Tạo đợt thu quỹ và theo dõi tiến độ từng kỳ." />

      <div className="grid gap-4 lg:grid-cols-[2fr_3fr]">
        <Card>
          <CardHeader title="Tạo kỳ thu mới" sub="Hệ thống sinh hóa đơn cho từng thành viên được chọn." />
          <form
            className="space-y-4 px-5 py-5"
            onSubmit={(e) => {
              e.preventDefault();
              setErr("");
              if (mode === "some" && selected.length === 0) {
                setErr("Hãy chọn ít nhất một thành viên");
                return;
              }
              create.mutate();
            }}
          >
            <Field label="Tên kỳ thu">
              <Input
                required
                placeholder="Ví dụ: Quỹ tháng 11"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label="Số tiền mỗi người (VND)">
              <Input
                required
                type="number"
                min={1000}
                step={1000}
                placeholder="50000"
                className="num"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </Field>
            <Field label="Hạn đóng">
              <Input
                required
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              />
            </Field>

            <fieldset className="border border-[var(--border)] px-3 pb-3 pt-4">
              <legend className="label-caps px-1">Áp dụng cho</legend>
              <label className="flex cursor-pointer items-center gap-2 py-1 text-sm">
                <input
                  type="radio"
                  name="memberMode"
                  checked={mode === "all"}
                  onChange={() => setMode("all")}
                  className="w-auto"
                />
                Tất cả thành viên đang hoạt động ({members.length} người)
              </label>
              <label className="flex cursor-pointer items-center gap-2 py-1 text-sm">
                <input
                  type="radio"
                  name="memberMode"
                  checked={mode === "some"}
                  onChange={() => setMode("some")}
                  className="w-auto"
                />
                Chọn từng thành viên
              </label>
              {mode === "some" && (
                <div className="pt-3">
                  <MemberPicker members={members} value={selected} onChange={setSelected} />
                </div>
              )}
            </fieldset>

            <ErrorText>{err || create.error?.message}</ErrorText>
            <Button type="submit" disabled={create.isPending} className="w-full">
              {create.isPending ? "Đang tạo…" : `Tạo kỳ thu${mode === "all" ? "" : ` cho ${selected.length} người`}`}
            </Button>
          </form>
        </Card>

        <div>
          {isLoading ? (
            <Spinner />
          ) : periods.length === 0 ? (
            <Empty>Chưa có kỳ thu nào. Tạo kỳ thu đầu tiên ở biểu mẫu bên trái.</Empty>
          ) : (
            <Card>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Kỳ thu</th>
                    <th>Hạn</th>
                    <th className="text-right">Mỗi người</th>
                    <th className="text-center">Đã đóng</th>
                    <th className="text-right">Tiến độ</th>
                  </tr>
                </thead>
                <tbody>
                  {periods.map((p) => {
                    const pct = p.total ? Math.round((p.paid / p.total) * 100) : 0;
                    return (
                      <tr key={p.id}>
                        <td>
                          <Link to={`/thu-quy/ky/${p.id}`} className="font-semibold">
                            {p.name}
                          </Link>
                        </td>
                        <td className="num whitespace-nowrap">{new Date(p.due_date).toLocaleDateString("vi-VN")}</td>
                        <td className="num text-right">{vnd(p.amount)}</td>
                        <td className="num text-center">
                          {p.paid}/{p.total}
                        </td>
                        <td className="w-32">
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 border border-[var(--border)] bg-[var(--mute-bg)]">
                              <div className="h-full bg-[var(--brand-700)]" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="num w-9 text-right text-xs font-bold">{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
