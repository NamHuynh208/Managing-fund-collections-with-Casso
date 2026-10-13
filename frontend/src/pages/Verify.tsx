import { Link, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";

export default function Verify() {
  const [sp] = useSearchParams();
  const token = sp.get("token") ?? "";
  const portal = sp.get("portal") ?? "member";

  const verify = useMutation({
    mutationFn: () =>
      api<{ next: string }>("/auth/verify-link", {
        method: "POST",
        body: JSON.stringify({ token, portal }),
      }),
    onSuccess: (r) => { window.location.href = r.next || "/"; },
  });

  return (
    <main className="mx-auto max-w-md p-4 space-y-3 text-left">
      <h1 className="text-2xl font-semibold">Xác nhận đăng nhập</h1>
      <div className="border rounded p-3 space-y-3">
        <p>Bấm nút bên dưới để vào Quỹ CLB.</p>
        {verify.error && <p className="text-red-600">{verify.error.message}</p>}
        <button disabled={!token || verify.isPending} onClick={() => verify.mutate()}
                className="border rounded px-3 py-2">
          {verify.isPending ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>
      </div>
      <p><Link to="/login" className="underline">← Quay lại đăng nhập</Link></p>
    </main>
  );
}