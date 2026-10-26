import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Button, Card, ErrorText } from "../components/ui";

export default function Verify() {
  const sp = new URLSearchParams(window.location.search);
  const token = sp.get("token") ?? "";
  const portal = sp.get("portal") ?? "member";

  const verify = useMutation({
    mutationFn: () =>
      api<{ next: string }>("/auth/verify-link", {
        method: "POST",
        body: JSON.stringify({ token, portal }),
      }),
    onSuccess: (r) => {
      window.location.href = r.next || "/";
    },
  });

  return (
    <div className="grid min-h-screen place-items-center bg-[var(--bg)] px-4">
      <Card className="w-full max-w-md px-6 py-8 text-center">
        <h1 className="text-lg font-bold">Xác nhận đăng nhập</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {token ? "Bấm nút bên dưới để hoàn tất đăng nhập." : "Thiếu mã đăng nhập trong liên kết."}
        </p>
        <div className="mt-5">
          <ErrorText>{verify.error?.message}</ErrorText>
        </div>
        <div className="mt-4 flex justify-center gap-3">
          <Button disabled={!token || verify.isPending} onClick={() => verify.mutate()}>
            {verify.isPending ? "Đang đăng nhập…" : "Đăng nhập"}
          </Button>
          <Button variant="ghost" onClick={() => (window.location.href = "/login")}>
            Quay lại
          </Button>
        </div>
      </Card>
      <p className="mt-4 text-sm">
        <Link to="/login">← Quay lại trang đăng nhập</Link>
      </p>
    </div>
  );
}
