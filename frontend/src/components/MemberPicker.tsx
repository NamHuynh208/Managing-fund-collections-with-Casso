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
      <input
        className="w-full border rounded p-2"
        placeholder="Tìm theo tên hoặc email"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="flex gap-3 text-sm flex-wrap">
        <button type="button" className="underline"
          onClick={() => onChange(Array.from(new Set([...value, ...shown.map((m) => m.id)])))}>
          Chọn tất cả đang hiển thị
        </button>
        <button type="button" className="underline" onClick={() => onChange([])}>
          Bỏ chọn hết
        </button>
        <span className="ml-auto">Đã chọn {value.length}/{members.length}</span>
      </div>
      <div className="max-h-64 overflow-y-auto border rounded divide-y">
        {shown.map((m) => (
          <label key={m.id} className="flex items-center gap-3 p-2 cursor-pointer">
            <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggle(m.id)} />
            <span>
              {m.full_name}
              <small className="block opacity-70">{m.email}</small>
            </span>
          </label>
        ))}
        {shown.length === 0 && <p className="p-2">Không có thành viên nào.</p>}
      </div>
    </div>
  );
}