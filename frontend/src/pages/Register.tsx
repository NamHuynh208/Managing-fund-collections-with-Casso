import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";
import { getConfig } from "../lib/config";
import { Button, Card, ErrorText, Field, Input } from "../components/ui";

export default function Register() {
  const [form, setForm] = useState({ full_name: "", email: "", note: "" });
  const send = useMutation({
    mutationFn: () => api("/auth/register", { method: "POST", body: JSON.stringify(form) }),
  });

  return (
    <div className="grid min-h-screen place-items-center bg-[var(--bg)] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center border-2 border-[var(--brand-900)] bg-[var(--brand-700)] text-xl font-black text-white">
            Q
          </div>
          <h1 className="text-xl font-bold uppercase tracking-wide">Đăng ký thành viên</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{getConfig().name}</p>
        </div>

        {send.isSuccess ? (
          <Card className="px-6 py-8 text-center">
            <p className="font-semibold">Đã gửi đơn đăng ký</p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Nếu email của bạn chưa có trong danh sách, đơn đã được gửi cho thủ quỹ xem xét. Khi được duyệt, bạn sẽ
              nhận email và đăng nhập được bằng email này.
            </p>
            <p className="mt-4 text-sm">
              Nếu bạn đã là thành viên, hãy <Link to="/login">đăng nhập</Link>.
            </p>
          </Card>
        ) : (
          <Card className="px-5 py-5">
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                send.mutate();
              }}
            >
              <Field label="Họ và tên">
                <Input
                  required
                  placeholder="Nguyễn Văn A"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                />
              </Field>
              <Field label="Email" hint="Dùng email này để đăng nhập và nhận thông báo quỹ.">
                <Input
                  required
                  type="email"
                  placeholder="ban@tenmienco.vn"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </Field>
              <Field label="Ghi chú cho thủ quỹ (không bắt buộc)">
                <Input
                  maxLength={300}
                  placeholder="Ví dụ: thành viên khóa 2026, ban tổ chức…"
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                />
              </Field>
              <ErrorText>{send.error?.message}</ErrorText>
              <Button type="submit" disabled={send.isPending} className="w-full">
                {send.isPending ? "Đang gửi…" : "Gửi đơn đăng ký"}
              </Button>
            </form>
          </Card>
        )}

        <p className="mt-4 text-center text-sm">
          <Link to="/login">← Quay lại đăng nhập</Link>
        </p>
      </div>
    </div>
  );
}
