import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { vnd } from "../../lib/format";
import MemberPicker, { type Member } from "../../components/MemberPicker";

type Period = { id: number; name: string; amount: number; due_date: string; total: number; paid: number };

export default function Periods() {
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["periods"],
    queryFn: () =>
      api<{ periods: Period[]; summary: { collected: number; spent: number; balance: number } }>(
        "/treasurer/periods"
      ),
  });
  const { data: mem } = useQuery({
    queryKey: ["members"],
    queryFn: () => api<{ members: Member[] }>("/treasurer/members"),
  });
  // Số giao dịch cần xử lý (trước đây luôn bằng 0 vì chưa được lấy từ API)
const { data: ovData } = useQuery({
  queryKey: ["overview"],
  queryFn: () => api<{ review_count: number }>("/treasurer/overview"),
  });

  const periods = data?.periods ?? [];
  const members = mem?.members ?? [];
  const ov = data?.summary
  ? { ...data.summary, review_count: ovData?.review_count ?? 0 }
  : undefined;

  const empty = { name: "", amount: "", due_date: "" };
  const [form, setForm] = useState(empty);
  const [mode, setMode] = useState<"all" | "some">("all");
  const [selected, setSelected] = useState<number[]>([]);
  const [err, setErr] = useState("");

  const create = useMutation({
    mutationFn: () =>
      api("/treasurer/periods", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          amount: Number(form.amount),
          due_date: form.due_date,
          member_ids: mode === "all" ? null : selected,
        }),
      }),
    onSuccess: () => {
      setForm(empty);
      setMode("all");
      setSelected([]);
      qc.invalidateQueries({ queryKey: ["periods"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
    },
  });

  return (
    <div className="space-y-4">
      {ov && (
        <div className="border rounded p-3">
          <b>Quỹ hiện có: {vnd(ov.balance)}</b>
          <div className="text-sm opacity-70">
            Đã thu {vnd(ov.collected)} · Đã chi {vnd(ov.spent)}
          </div>
          {ov.review_count > 0 && (
            <Link to="/thu-quy/giao-dich" className="text-sm underline">
              Có {ov.review_count} giao dịch cần xử lý
            </Link>
          )}
        </div>
      )}

      <form
  className="border rounded p-4 space-y-4"
  onSubmit={(e) => {
  e.preventDefault();
  setErr("");
  if (mode === "some" && selected.length === 0) {
    setErr("Hãy chọn ít nhất một thành viên");
    return;
  }
  create.mutate();
}}
>
  <h2 className="text-lg font-semibold">Tạo kỳ thu mới</h2>

  <input
    required
    placeholder="Tên kỳ (ví dụ: Quỹ tháng 10)"
    className="border rounded p-2 w-full"
    value={form.name}
    onChange={(e) =>
      setForm({ ...form, name: e.target.value })
    }
  />

  <input
    required
    type="number"
    min={1000}
    placeholder="Số tiền mỗi người (VND)"
    className="border rounded p-2 w-full"
    value={form.amount}
    onChange={(e) =>
      setForm({ ...form, amount: e.target.value })
    }
  />

  <input
    required
    type="date"
    className="border rounded p-2 w-full"
    value={form.due_date}
    onChange={(e) =>
      setForm({ ...form, due_date: e.target.value })
    }
  />

  <div className="border rounded p-3 space-y-3">
    <h3 className="font-semibold">Áp dụng cho</h3>

    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="radio"
        name="memberMode"
        checked={mode === "all"}
        onChange={() => setMode("all")}
      />
      Tất cả thành viên ({members.length} người)
    </label>

    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="radio"
        name="memberMode"
        checked={mode === "some"}
        onChange={() => setMode("some")}
      />
      Chọn thành viên
    </label>

    {mode === "some" && (
      <div className="pt-2">
        <p className="text-sm mb-2">
          Danh sách thành viên: {members.length} người
        </p>

        <MemberPicker
          members={members}
          value={selected}
          onChange={setSelected}
        />
      </div>
    )}
  </div>

  {(err || create.error) && (
    <p className="text-red-600">
      {err || create.error?.message}
    </p>
  )}

  <button
    type="submit"
    disabled={create.isPending}
    className="border rounded px-4 py-2"
  >
    {create.isPending ? "Đang tạo..." : "Tạo kỳ thu"}
  </button>
</form>

      <table className="w-full text-left">
        <thead><tr><th>Kỳ</th><th>Hạn</th><th>Số tiền</th><th>Đã đóng</th></tr></thead>
        <tbody>
          {periods.map((p) => (
            <tr key={p.id} className="border-t">
              <td><Link className="underline" to={`/thu-quy/ky/${p.id}`}>{p.name}</Link></td>
              <td>{new Date(p.due_date).toLocaleDateString("vi-VN")}</td>
              <td>{vnd(p.amount)}</td>
              <td>{p.paid}/{p.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}