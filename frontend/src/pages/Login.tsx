import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";
import { getConfig } from "../lib/config";
import { Button, Card, ErrorText, Field, Input } from "../components/ui";

type Portal = "member" | "treasurer" | "admin";

const PORTALS: { key: Portal; label: string; hint: string }[] = [
  { key: "member", label: "Thành viên", hint: "Dành cho thành viên CLB — xem khoản cần đóng và mã QR chuyển khoản." },
  { key: "treasurer", label: "Thủ quỹ", hint: "Chỉ tài khoản có vai trò Thủ quỹ đăng nhập được." },
  { key: "admin", label: "Admin", hint: "Chỉ tài khoản quản trị đăng nhập được (vào trang admin)." },
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
  const sending = useRef(false); // khóa tức thì, không chờ giao diện vẽ lại

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
    onSettled: () => {
      sending.current = false;
    },
  });

  const submitEmail = () => {
    if (sending.current || left > 0) return; // đang gửi hoặc chưa hết 60 giây
    sending.current = true;
    request.mutate();
  };

  const verify = useMutation({
    mutationFn: () =>
      api<{ next: string }>("/auth/verify-code", {
        method: "POST",
        body: JSON.stringify({ email, code, portal }),
      }),
    onSuccess: (r) => {
      window.location.href = r.next || "/";
    },
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
    <div className="grid min-h-screen place-items-center bg-[var(--bg)] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center border-2 border-[var(--brand-900)] bg-[var(--brand-700)] text-xl font-black text-white">
            Q
          </div>
          <h1 className="text-xl font-bold uppercase tracking-wide">{getConfig().name}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Đăng nhập bằng liên kết hoặc mã gửi qua email</p>
        </div>

        <Card>
          {/* Chọn cổng đăng nhập */}
          <div className="grid grid-cols-3 border-b border-[var(--border)]">
            {PORTALS.map((p, i) => (
              <button
                key={p.key}
                type="button"
                onClick={() => pickPortal(p.key)}
                className={
                  "px-2 py-3 text-sm font-semibold " +
                  (i > 0 ? "border-l border-[var(--border)] " : "") +
                  (portal === p.key
                    ? "bg-[var(--brand-700)] text-white"
                    : "bg-white text-[var(--muted)] hover:bg-[var(--brand-50)]")
                }
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="px-5 py-5">
            <p className="mb-4 border-l-4 border-[var(--brand-200)] bg-[var(--brand-50)] px-3 py-2 text-xs text-[var(--muted)]">
              {current.hint}
            </p>

            {step === "email" ? (
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  submitEmail();
                }}
              >
                <Field label="Email đã đăng ký">
                  <Input
                    required
                    type="email"
                    autoFocus
                    placeholder="ban@tenmienco.vn"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>
                <ErrorText>{request.error?.message}</ErrorText>
                <Button type="submit" disabled={request.isPending || left > 0} className="w-full">
                  {request.isPending
                    ? "Đang gửi…"
                    : left > 0
                      ? `Đã gửi, thử lại sau ${left}s`
                      : `Gửi liên kết đăng nhập (${current.label})`}
                </Button>
              </form>
            ) : (
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  submitCode();
                }}
              >
                <p className="text-sm">
                  Nếu <b>{email}</b> có quyền <b>{current.label}</b>, thư đăng nhập đang được gửi. Bấm liên kết trong
                  thư, hoặc nhập mã 6 số:
                </p>
                <Input
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  autoFocus
                  className="mono text-center text-2xl font-bold tracking-[0.5em]"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
                <ErrorText>{verify.error?.message || request.error?.message}</ErrorText>
                <Button type="submit" disabled={verify.isPending} className="w-full">
                  {verify.isPending ? "Đang kiểm tra…" : "Đăng nhập"}
                </Button>
                <div className="flex justify-between text-sm">
                  <button
                    type="button"
                    className="underline disabled:opacity-50"
                    disabled={request.isPending || left > 0}
                    onClick={submitEmail}
                  >
                    {left > 0 ? `Gửi lại mã sau ${left}s` : "Gửi lại mã"}
                  </button>
                  <button
                    type="button"
                    className="underline"
                    onClick={() => {
                      setStep("email");
                      verify.reset();
                    }}
                  >
                    Đổi email
                  </button>
                </div>
              </form>
            )}
          </div>
        </Card>

        <p className="mt-4 text-center text-sm">
          Chưa có tài khoản?{" "}
          <Link to="/register">Đăng ký thành viên</Link>
        </p>
      </div>
    </div>
  );
}
