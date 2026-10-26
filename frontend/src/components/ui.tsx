import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

/* ============================================================
   Bộ component cơ bản: phẳng, sắc cạnh, tông xanh lá.
   ============================================================ */

type Variant = "primary" | "outline" | "danger" | "ghost" | "dark";

export function Button({
  variant = "primary",
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const base =
    "inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold border transition-colors select-none disabled:opacity-50 disabled:cursor-not-allowed active:translate-y-px";
  const styles: Record<Variant, string> = {
    primary: "bg-[var(--brand-700)] border-[var(--brand-700)] text-white hover:bg-[var(--brand-800)] hover:border-[var(--brand-800)]",
    outline: "bg-white border-[var(--brand-700)] text-[var(--brand-800)] hover:bg-[var(--brand-50)]",
    danger: "bg-white border-[#b33636] text-[#8c1d1d] hover:bg-[var(--bad-bg)]",
    ghost: "bg-transparent border-transparent text-[var(--brand-800)] hover:bg-[var(--brand-50)] underline underline-offset-2",
    dark: "bg-[var(--brand-900)] border-[var(--brand-900)] text-white hover:bg-black",
  };
  return (
    <button className={`${base} ${styles[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`bg-white border border-[var(--border)] ${className}`}>{children}</div>;
}

export function CardHeader({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {sub && <p className="mt-0.5 text-sm text-[var(--muted)]">{sub}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "ok" | "warn" | "bad";
}) {
  const tones = {
    default: "border-l-[var(--brand-700)]",
    ok: "border-l-[var(--brand-600)]",
    warn: "border-l-[#c98a12]",
    bad: "border-l-[#b33636]",
  } as const;
  return (
    <div className={`border border-[var(--border)] border-l-4 bg-white px-4 py-3.5 ${tones[tone]}`}>
      <div className="label-caps">{label}</div>
      <div className="num mt-1 text-xl font-bold tracking-tight">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-[var(--muted)]">{hint}</div>}
    </div>
  );
}

type BadgeTone = "ok" | "warn" | "bad" | "mute" | "brand";
export function Badge({ tone = "mute", children }: { tone?: BadgeTone; children: ReactNode }) {
  const tones: Record<BadgeTone, string> = {
    ok: "bg-[var(--ok-bg)] text-[var(--ok-fg)] border-[var(--ok-fg)]",
    warn: "bg-[var(--warn-bg)] text-[var(--warn-fg)] border-[var(--warn-fg)]",
    bad: "bg-[var(--bad-bg)] text-[var(--bad-fg)] border-[var(--bad-fg)]",
    mute: "bg-[var(--mute-bg)] text-[var(--mute-fg)] border-[var(--mute-fg)]",
    brand: "bg-[var(--brand-100)] text-[var(--brand-900)] border-[var(--brand-900)]",
  };
  return (
    <span className={`inline-block border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${tones[tone]}`}>
      {children}
    </span>
  );
}

export const InvoiceStatusBadge = ({ status }: { status: string }) =>
  status === "paid" ? <Badge tone="ok">Đã đóng</Badge>
  : status === "pending" ? <Badge tone="warn">Chưa đóng</Badge>
  : <Badge tone="mute">Đã hủy</Badge>;

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label-caps block mb-1.5">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-[var(--muted)]">{hint}</span>}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} />;
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="border border-dashed border-[var(--border)] bg-white px-6 py-10 text-center text-sm text-[var(--muted)]">
      {children}
    </div>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p className="border-l-4 border-[#b33636] bg-[var(--bad-bg)] px-3 py-2 text-sm text-[var(--bad-fg)]">
      {children}
    </p>
  );
}

export function Spinner({ text = "Đang tải…" }: { text?: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-10 justify-center text-sm text-[var(--muted)]">
      <span className="inline-block h-3.5 w-3.5 animate-spin border-2 border-[var(--brand-700)] border-t-transparent" />
      {text}
    </div>
  );
}

export function PageHeader({
  title,
  sub,
  actions,
}: {
  title: string;
  sub?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {sub && <p className="mt-1 text-sm text-[var(--muted)]">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
