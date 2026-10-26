import { useMemo, useState } from "react";

export type Member = { id: number; full_name: string; email: string };

type Props = { members: Member[]; value: number[]; onChange: (ids: number[]) => void };

export default function MemberPicker({ members, value, onChange }: Props) {
  const [q, setQ] = useState("");
  const selected = new Set(value);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return members;
    return members.filter(
      (m) => m.full_name.toLowerCase().includes(s) || m.email.toLowerCase().includes(s)
    );
  }, [members, q]);

  const toggle = (id: number) =>
    onChange(selected.has(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <div className="space-y-2">
      <input placeholder="Tìm theo tên hoặc email" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="flex flex-wrap gap-3 text-sm">
        <button
          type="button"
          className="underline"
          onClick={() => onChange(Array.from(new Set([...value, ...shown.map((m) => m.id)])))}
        >
          Chọn tất cả đang hiển thị
        </button>
        <button type="button" className="underline" onClick={() => onChange([])}>
          Bỏ chọn hết
        </button>
        <span className="ml-auto text-[var(--muted)]">
          Đã chọn {value.length}/{members.length}
        </span>
      </div>
      <div className="max-h-64 divide-y divide-[var(--border)] overflow-y-auto border border-[var(--border)] bg-white">
        {shown.map((m) => (
          <label key={m.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-[var(--brand-50)]">
            <input
              type="checkbox"
              className="w-auto"
              checked={selected.has(m.id)}
              onChange={() => toggle(m.id)}
            />
            <span>
              {m.full_name}
              <small className="block text-xs text-[var(--muted)]">{m.email}</small>
            </span>
          </label>
        ))}
        {shown.length === 0 && <p className="px-3 py-3 text-sm text-[var(--muted)]">Không có thành viên nào.</p>}
      </div>
    </div>
  );
}
