import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";

type Portal = "member" | "treasurer" | "admin";

const PORTALS: { key: Portal; label: string; hint: string }[] = [
  { key: "member", label: "Thành viên", hint: "Dành cho thành viên CLB." },
  { key: "treasurer", label: "Thủ quỹ", hint: "Chỉ tài khoản có vai trò Thủ quỹ đăng nhập được." },
  { key: "admin", label: "Admin", hint: "Chỉ tài khoản quản trị đăng nhập được." },
];

const COOLDOWN_MS = 60_000;

export default function Login() {
  const [portal, setPortal] = useState<Portal>("member");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");

  // Đếm ngược gửi lại, tính riêng cho từng cặp email + cổng
  const [sent, setSent] = useState<{ key: string; until: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  const sending = useRef(false);          // khóa tức thì, không chờ giao diện vẽ lại

  const current = PORTALS.find((p) => p.key === portal)!;
  const key = `${email.trim().toLowerCase()}|${portal}`;
  const left = sent && sent.key === key ? Math.max(0, Math.ceil((sent.until - now) / 1000)) : 0;

  useEffect(() => {
    if (left <= 0) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [left > 0]);

  const request = useMutation({
    mutationFn: () =>
      api("/auth/request", { method: "POST", body: JSON.stringify({ email, portal }) }),
    onSuccess: () => {
      setSent({ key, until: Date.now() + COOLDOWN_MS });
      setNow(Date.now());
      setStep("code");
    },
    onSettled: () => { sending.current = false; },
  });

  const submitEmail = () => {
    if (sending.current || left > 0) return;   // đang gửi hoặc chưa hết 60 giây
    sending.current = true;
    request.mutate();
  };

  const verify = useMutation({
    mutationFn: () =>
      api<{ next: string }>("/auth/verify-code", {
        method: "POST",
        body: JSON.stringify({ email, code, portal }),
      }),
    onSuccess: (r) => { window.location.href = r.next || "/"; },
  });

  const submitCode = () => {
    if (verify.isPending) return;
    verify.mutate();
  };

  const pickPortal = (p: Portal) => {
    setPortal(p);
    setStep("email");
    setCode("");
    request.reset();
    verify.reset();
  };

  return (
    <main className="mx-auto max-w-md p-4 space-y-4 text-left">
      <h1 className="text-2xl font-semibold">Đăng nhập</h1>

      <div className="grid grid-cols-3 gap-2">
        {PORTALS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => pickPortal(p.key)}
            className={"border rounded px-2 py-2 " + (portal === p.key ? "border-2 font-bold" : "")}
          >
            {p.label}
          </button>
        ))}
      </div>
      <p className="text-sm">{current.hint}</p>

      {step === "email" ? (
        <form
          className="border rounded p-3 space-y-3"
          onSubmit={(e) => { e.preventDefault(); submitEmail(); }}
        >
          <input required type="email" className="border rounded p-2 w-full"
                 placeholder="Email đã đăng ký" value={email}
                 onChange={(e) => setEmail(e.target.value)} />
          {request.error && <p className="text-red-600">{request.error.message}</p>}
          <button disabled={request.isPending || left > 0} className="border rounded px-3 py-2">
            {request.isPending
              ? "Đang gửi..."
              : left > 0
              ? `Đã gửi, thử lại sau ${left}s`
              : `Gửi liên kết đăng nhập (${current.label})`}
          </button>
        </form>
      ) : (
        <form
          className="border rounded p-3 space-y-3"
          onSubmit={(e) => { e.preventDefault(); submitCode(); }}
        >
          <p>
            Nếu <b>{email}</b> có quyền <b>{current.label}</b>, thư đăng nhập đang được gửi.
            Bấm liên kết trong thư, hoặc nhập mã 6 số:
          </p>
          <input required inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                 pattern="[0-9]{6}" className="border rounded p-2 w-full"
                 value={code} onChange={(e) => setCode(e.target.value)} />
          {verify.error && <p className="text-red-600">{verify.error.message}</p>}
          {request.error && <p className="text-red-600">{request.error.message}</p>}
          <div className="flex gap-3 items-center flex-wrap">
            <button disabled={verify.isPending} className="border rounded px-3 py-2">
              {verify.isPending ? "Đang kiểm tra..." : "Đăng nhập"}
            </button>
            <button type="button" className="underline"
                    disabled={request.isPending || left > 0} onClick={submitEmail}>
              {left > 0 ? `Gửi lại mã sau ${left}s` : "Gửi lại mã"}
            </button>
            <button type="button" className="underline"
                    onClick={() => { setStep("email"); verify.reset(); }}>
              Đổi email
            </button>
          </div>
        </form>
      )}

      <p>Chưa có tài khoản? <Link to="/register" className="underline">Đăng ký thành viên</Link></p>
    </main>
  );
}