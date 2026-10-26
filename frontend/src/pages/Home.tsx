import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { api } from "../lib/api";
import Layout from "../components/Layout";
import CopyButton from "../components/CopyButton";
import { Card, CardHeader, Empty, InvoiceStatusBadge, StatCard } from "../components/ui";
import { day, vnd } from "../lib/format";

type Invoice = {
  id: number;
  period: string;
  amount: number;
  due_date: string;
  status: string;
  paid_at: string | null;
  qr_payload: string | null;
};

type Me = { id: number; full_name: string; email: string; role: string; transfer_code: string };

export default function Home() {
  const { data: me } = useQuery<Me>({ queryKey: ["me"], queryFn: () => api("/me") });
  const { data } = useQuery<{ invoices: Invoice[]; bank: { account_no: string; account_name: string } }>({
    queryKey: ["my-invoices"],
    queryFn: () => api("/me/invoices"),
  });
  if (!me || !data) return null;

  const pending = data.invoices.filter((i) => i.status === "pending");
  const paid = data.invoices.filter((i) => i.status === "paid");
  const paidTotal = paid.reduce((s, i) => s + i.amount, 0);
  const owedTotal = pending.reduce((s, i) => s + i.amount, 0);

  return (
    <Layout wide>
      <div className="mb-6">
        <p className="label-caps">Trang thành viên</p>
        <h1 className="text-2xl font-bold tracking-tight">Xin chào, {me.full_name}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Mã chuyển khoản của bạn: <code className="bg-[var(--brand-50)] px-1.5 py-0.5 font-bold text-[var(--brand-800)]">{me.transfer_code}</code>
        </p>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="Đang cần đóng" value={vnd(owedTotal)} hint={`${pending.length} khoản chờ`} tone={pending.length ? "warn" : "ok"} />
        <StatCard label="Đã đóng toàn bộ" value={vnd(paidTotal)} hint={`${paid.length} khoản đã ghi nhận`} tone="ok" />
        <StatCard label="Tài khoản nhận" value={data.bank.account_no} hint={data.bank.account_name} />
      </div>

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Khoản cần đóng</h2>
          {pending.length > 0 && <span className="label-caps">{pending.length} khoản</span>}
        </div>

        {pending.length === 0 ? (
          <Empty>
            🎉 Bạn không có khoản nào cần đóng. Cảm ơn bạn đã đóng góp quỹ!
          </Empty>
        ) : (
          <div className="space-y-4">
            {pending.map((inv) => (
              <Card key={inv.id}>
                <CardHeader
                  title={inv.period}
                  sub={
                    <>
                      Hạn ngày <b>{day(inv.due_date)}</b> · <span className="num font-bold text-[var(--brand-800)]">{vnd(inv.amount)}</span>
                    </>
                  }
                  right={<InvoiceStatusBadge status={inv.status} />}
                />
                <div className="grid gap-5 p-5 md:grid-cols-[auto_1fr]">
                  {inv.qr_payload && (
                    <div className="mx-auto border border-[var(--border)] bg-white p-3">
                      <QRCodeSVG value={inv.qr_payload} size={190} marginSize={0} />
                      <p className="mt-2 text-center text-[11px] text-[var(--muted)]">
                        Mở app ngân hàng → quét QR
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-[var(--muted)]">
                      Chuyển khoản đúng thông tin bên dưới để hệ thống tự động ghi nhận:
                    </p>
                    <dl className="mt-3 divide-y divide-[var(--border)] border border-[var(--border)] bg-[var(--brand-50)]">
                      {[
                        ["Chủ tài khoản", data.bank.account_name],
                        ["Số tài khoản", data.bank.account_no],
                        ["Số tiền", vnd(inv.amount)],
                        ["Nội dung chuyển khoản", me.transfer_code],
                      ].map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between gap-3 px-3 py-2">
                          <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{k}</dt>
                          <dd className="mono num flex items-center gap-2 text-right font-bold">{v}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <CopyButton
                        text={me.transfer_code}
                        label="Sao chép nội dung"
                      />
                      <CopyButton
                        text={`${data.bank.account_no} - ${data.bank.account_name} - ${vnd(inv.amount)} - ${me.transfer_code}`}
                        label="Sao chép tất cả"
                      />
                    </div>
                    <p className="mt-3 text-xs text-[var(--muted)]">
                      Giữ nguyên số tiền và nội dung để hệ thống tự ghi nhận. Đóng đủ và đúng hạn giúp thủ quỹ đỡ vất vả nhé.
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Lịch sử đã đóng</h2>
          {paid.length > 0 && <span className="label-caps">Tổng {vnd(paidTotal)}</span>}
        </div>
        {paid.length === 0 ? (
          <Empty>Chưa có khoản nào được ghi nhận.</Empty>
        ) : (
          <Card>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Kỳ thu</th>
                  <th className="text-right">Số tiền</th>
                  <th className="text-right">Thời điểm ghi nhận</th>
                </tr>
              </thead>
              <tbody>
                {paid.map((i) => (
                  <tr key={i.id}>
                    <td className="font-medium">{i.period}</td>
                    <td className="num text-right font-bold">{vnd(i.amount)}</td>
                    <td className="num text-right text-[var(--muted)]">{new Date(i.paid_at!).toLocaleString("vi-VN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>
    </Layout>
  );
}
