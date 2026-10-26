import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { Button, Card, CardHeader, ErrorText, Field, Input, PageHeader, Spinner } from "../../components/ui";
import { vnd } from "../../lib/format";

type Detail = {
  id: number;
  name: string;
  amount: number;
  due_date: string;
  invoices: { id: number; member: string; email: string; status: string; paid_at: string | null }[];
};

const send = (path: string, body?: unknown) =>
  api(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

export default function PeriodDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<Detail>({
    queryKey: ["period", id],
    queryFn: () => api(`/treasurer/periods/${id}`),
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
        name: form.name,
        amount: Number(form.amount),
        due_date: form.due_date,
      }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: () => send(`/treasurer/periods/${id}/delete`),
    onSuccess: () => {
      qc.removeQueries({ queryKey: ["period", id] });
      qc.invalidateQueries({ queryKey: ["periods"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
      nav("/thu-quy/ky");
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
  const remind = useMutation({
    mutationFn: () => send(`/treasurer/periods/${id}/remind`),
    onSuccess: refresh,
  });

  if (isLoading) return <Spinner />;
  if (!data) return <p>Không tìm thấy kỳ thu.</p>;

  const pending = data.invoices.filter((i) => i.status === "pending");
  const paidCount = data.invoices.length - pending.length;
  const err =
    update.error?.message || remove.error?.message || cash.error?.message || cancel.error?.message || remind.error?.message;
  const csvUrl = `/api/treasurer/periods/${id}/csv`;

  return (
    <div>
      <Link to="/thu-quy/ky" className="text-sm">
        ← Kỳ thu
      </Link>
      <PageHeader
        title={data.name}
        sub={
          <>
            Hạn <b>{new Date(data.due_date).toLocaleDateString("vi-VN")}</b> · {vnd(data.amount)} / người · Đã đóng{" "}
            <b>
              {paidCount}/{data.invoices.length}
            </b>
          </>
        }
        actions={
          <>
            {pending.length > 0 && (
              <Button variant="outline" disabled={remind.isPending} onClick={() => remind.mutate()}>
                {remind.isPending ? "Đang gửi…" : `Nhắc ${pending.length} người chưa đóng`}
              </Button>
            )}
            <a href={csvUrl}>
              <Button variant="dark" type="button">
                Xuất CSV
              </Button>
            </a>
          </>
        }
      />

      <ErrorText>{err}</ErrorText>
      {remind.isSuccess && (
        <p className="mb-4 border-l-4 border-[var(--brand-700)] bg-[var(--brand-50)] px-3 py-2 text-sm">
          Đã gửi nhắc nhở tới {remind.data?.sent}/{remind.data?.total} người chưa đóng.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[2fr_3fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Sửa kỳ thu" />
            <form
              className="space-y-3 px-5 py-5"
              onSubmit={(e) => {
                e.preventDefault();
                update.mutate();
              }}
            >
              <Field label="Tên kỳ">
                <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="Số tiền mỗi người (VND)">
                <Input
                  required
                  type="number"
                  min={1000}
                  step={1000}
                  className="num"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </Field>
              <Field label="Hạn đóng">
                <Input required type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </Field>
              <p className="text-xs text-[var(--muted)]">
                Đổi số tiền thì chỉ các hóa đơn <b>chưa đóng</b> đổi theo, hóa đơn đã đóng giữ nguyên.
              </p>
              <div className="flex items-center gap-3">
                <Button type="submit" disabled={update.isPending}>
                  {update.isPending ? "Đang lưu…" : "Lưu thay đổi"}
                </Button>
                {update.isSuccess && !update.isPending && <small className="text-[var(--brand-700)]">Đã lưu</small>}
              </div>
            </form>
          </Card>

          <Card>
            <CardHeader title="Xóa kỳ thu" />
            <div className="space-y-3 px-5 py-5">
              {paidCount > 0 ? (
                <p className="text-sm text-[var(--bad-fg)]">
                  Đã có {paidCount} người đóng nên không thể xóa kỳ này. Hãy sửa kỳ thu hoặc hủy từng hóa đơn chưa đóng.
                </p>
              ) : (
                <p className="text-sm text-[var(--muted)]">
                  Xóa kỳ và toàn bộ hóa đơn chưa đóng của kỳ. Không thể hoàn tác.
                </p>
              )}
              <Button variant="danger" disabled={paidCount > 0 || remove.isPending} onClick={() => remove.mutate()}>
                {remove.isPending ? "Đang xóa…" : "Xóa kỳ thu"}
              </Button>
            </div>
          </Card>
        </div>

        <Card>
          <table className="tbl">
            <thead>
              <tr>
                <th>Thành viên</th>
                <th>Trạng thái</th>
                <th className="text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {data.invoices.map((i) => (
                <tr key={i.id}>
                  <td>
                    <span className="font-medium">{i.member}</span>
                    <span className="block text-xs text-[var(--muted)]">{i.email}</span>
                  </td>
                  <td>
                    {i.status === "paid" ? (
                      <span className="num text-[var(--brand-700)]">
                        Đã đóng {i.paid_at ? new Date(i.paid_at).toLocaleString("vi-VN") : ""}
                      </span>
                    ) : i.status === "pending" ? (
                      <span className="text-[var(--warn-fg)]">Chưa đóng</span>
                    ) : (
                      <span className="text-[var(--muted)]">Đã hủy</span>
                    )}
                  </td>
                  <td className="space-x-2 whitespace-nowrap text-right text-sm">
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
        </Card>
      </div>
    </div>
  );
}
