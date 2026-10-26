import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import CopyButton from "../../components/CopyButton";
import { Badge, Card, Empty, ErrorText, Input, PageHeader, Spinner } from "../../components/ui";
import { vnd } from "../../lib/format";

type Member = {
  id: number;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  transfer_code: string;
  paid_total: number;
  unpaid_count: number;
};

export default function Members() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery<{ members: Member[] }>({
    queryKey: ["members"],
    queryFn: () => api("/treasurer/members"),
  });

  const update = useMutation({
    mutationFn: ({ id, ...body }: { id: number; role?: string; is_active?: boolean }) =>
      api(`/treasurer/members/${id}/update`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
    },
  });

  const members = (data?.members ?? []).filter(
    (m) =>
      !q.trim() ||
      m.full_name.toLowerCase().includes(q.toLowerCase()) ||
      m.email.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div>
      <PageHeader
        title="Thành viên"
        sub="Quản lý vai trò, khóa tài khoản và xem mã chuyển khoản của từng người."
      />

      <ErrorText>{update.error?.message}</ErrorText>

      <div className="mb-4">
        <Input
          placeholder="Tìm theo tên hoặc email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-md"
        />
      </div>

      {isLoading ? (
        <Spinner />
      ) : members.length === 0 ? (
        <Empty>Không có thành viên nào khớp tìm kiếm.</Empty>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Thành viên</th>
                  <th>Mã chuyển khoản</th>
                  <th className="text-right">Đã đóng</th>
                  <th className="text-center">Chưa đóng</th>
                  <th>Vai trò</th>
                  <th className="text-right">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className={m.is_active ? "" : "opacity-55"}>
                    <td>
                      <span className="font-medium">{m.full_name}</span>
                      <span className="block text-xs text-[var(--muted)]">{m.email}</span>
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-2">
                        <code className="bg-[var(--brand-50)] px-1.5 py-0.5 font-bold text-[var(--brand-800)]">
                          {m.transfer_code}
                        </code>
                        <CopyButton text={m.transfer_code} label="Copy" />
                      </span>
                    </td>
                    <td className="num text-right font-semibold">{vnd(m.paid_total)}</td>
                    <td className="num text-center">
                      {m.unpaid_count > 0 ? (
                        <Badge tone="warn">{m.unpaid_count}</Badge>
                      ) : (
                        <span className="text-[var(--muted)]">0</span>
                      )}
                    </td>
                    <td>
                      <select
                        className="w-auto !py-1 text-sm"
                        value={m.role}
                        disabled={update.isPending}
                        onChange={(e) => update.mutate({ id: m.id, role: e.target.value })}
                      >
                        <option value="member">Thành viên</option>
                        <option value="treasurer">Thủ quỹ</option>
                      </select>
                    </td>
                    <td className="text-right">
                      <button
                        className="text-sm underline"
                        disabled={update.isPending}
                        onClick={() => update.mutate({ id: m.id, is_active: !m.is_active })}
                      >
                        {m.is_active ? "Đang hoạt động — khóa" : "Đã khóa — mở lại"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-[var(--border)] px-5 py-2.5 text-xs text-[var(--muted)]">
            Khóa tài khoản = người đó không đăng nhập được và không nằm trong "tất cả thành viên" khi tạo kỳ thu mới.
          </p>
        </Card>
      )}
    </div>
  );
}
