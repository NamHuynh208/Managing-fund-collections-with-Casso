import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { post } from "../lib/api";

export default function Login() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const nav = useNavigate();
  const qc = useQueryClient();

  async function send(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    try { await post("/auth/request", { email }); setSent(true); }
    catch (e: any) { setErr(e.message); }
  }
  async function verify(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    try {
      await post("/auth/verify-code", { email, code });
      await qc.invalidateQueries({ queryKey: ["me"] });
      nav("/", { replace: true });
    } catch (e: any) { setErr(e.message); }
  }

  return (
    <main className="mx-auto max-w-md p-4">
      <h1 className="text-2xl font-semibold mb-4">Đăng nhập</h1>
      {!sent ? (
        <form onSubmit={send} className="space-y-3">
          <p>Nhập email đã đăng ký với CLB, bạn sẽ nhận liên kết đăng nhập.</p>
          <input className="w-full border rounded p-2" type="email" required value={email}
                 onChange={(e) => setEmail(e.target.value)} />
          <button className="rounded px-4 py-2 text-white" style={{ background: "var(--primary)" }}>
            Gửi liên kết đăng nhập
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-3">
          <p>Nếu <b>{email}</b> có trong danh sách, thư đăng nhập đang được gửi. Bấm liên kết trong thư, hoặc nhập mã 6 số:</p>
          <input className="w-full border rounded p-2" inputMode="numeric" autoComplete="one-time-code"
                 maxLength={6} pattern="[0-9]{6}" required value={code}
                 onChange={(e) => setCode(e.target.value)} />
          <button className="rounded px-4 py-2 text-white" style={{ background: "var(--primary)" }}>Đăng nhập</button>
        </form>
      )}
      {err && <p className="mt-3 text-red-600">{err}</p>}
    </main>
  );
}