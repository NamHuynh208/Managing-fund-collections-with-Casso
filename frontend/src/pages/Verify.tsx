import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { post } from "../lib/api";

export default function Verify() {
  const [params] = useSearchParams();
  const [err, setErr] = useState("");
  const nav = useNavigate();
  const qc = useQueryClient();

  async function confirm() {
    try {
      await post("/auth/verify-link", { token: params.get("token") ?? "" });
      await qc.invalidateQueries({ queryKey: ["me"] });
      nav("/", { replace: true });
    } catch (e: any) { setErr(e.message); }
  }

  return (
    <main className="mx-auto max-w-md p-4">
      <h1 className="text-2xl font-semibold mb-4">Xác nhận đăng nhập</h1>
      <p className="mb-3">Bấm nút bên dưới để vào Quỹ CLB.</p>
      <button onClick={confirm} className="rounded px-4 py-2 text-white" style={{ background: "var(--primary)" }}>
        Đăng nhập
      </button>
      {err && <p className="mt-3 text-red-600">{err} <a className="underline" href="/login">Yêu cầu lại</a></p>}
    </main>
  );
}