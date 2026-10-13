import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { api, post } from "../lib/api";

const vnd = (n: number) => n.toLocaleString("vi-VN") + " đ";
const day = (s: string | null) => (s ? new Date(s).toLocaleDateString("vi-VN") : "");

export default function Home() {
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => api("/me") });
  const { data } = useQuery({ queryKey: ["my-invoices"], queryFn: () => api("/me/invoices") });
  if (!me || !data) return null;

  const pending = data.invoices.filter((i: any) => i.status === "pending");
  const paid = data.invoices.filter((i: any) => i.status === "paid");

  async function logout() {
    await post("/auth/logout");
    qc.clear();
    window.location.href = "/login";
  }

  return (
    <main className="mx-auto max-w-2xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Xin chào, {me.full_name}</h1>
        <button onClick={logout} className="underline">Đăng xuất</button>
      </div>



      <h2 className="text-xl font-semibold">Cần đóng</h2>
      {pending.length === 0 && <p className="text-green-700">Bạn không có khoản nào cần đóng.</p>}
      {pending.map((inv: any) => (
        <div key={inv.id} className="border rounded p-3 space-y-2" style={{ background: "var(--card)" }}>
          <b>{inv.period}</b>: {vnd(inv.amount)} (hạn {day(inv.due_date)})
          <div className="bg-white p-2 inline-block rounded">
            <QRCodeSVG value={inv.qr_payload} size={220} marginSize={2} />
          </div>
          <p>
            Chủ TK: <b>{data.bank.account_name}</b><br />
            Số TK: <b>{data.bank.account_no}</b><br />
            Số tiền: <b>{vnd(inv.amount)}</b><br />
            Nội dung: <b>{me.transfer_code}</b>
          </p>
          <small>Giữ nguyên số tiền và nội dung để hệ thống tự ghi nhận.</small>
        </div>
      ))}

      <h2 className="text-xl font-semibold">Lịch sử đã đóng</h2>
      <table className="w-full">
        <tbody>
          {paid.length === 0 && <tr><td>Chưa có.</td></tr>}
          {paid.map((i: any) => (
            <tr key={i.id} className="border-b">
              <td className="py-2">{i.period}</td><td>{vnd(i.amount)}</td><td>{day(i.paid_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}