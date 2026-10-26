import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { Badge, Button, Card, Empty, ErrorText, PageHeader, Spinner } from "../../components/ui";
import { dt } from "../../lib/format";

type Reg = { id: number; full_name: string; email: string; note: string; created_at: string };

export default function Registrations() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ pending: number; items: Reg[] }>({
    queryKey: ["registrations"],
    queryFn: () => api("/treasurer/registrations"),
  });

  const act = useMutation({
    mutationFn: ({ id, kind }: { id: number; kind: "approve" | "reject" }) =>
      api(`/treasurer/registrations/${id}/${kind}`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["registrations"] });
      qc.invalidateQueries({ queryKey: ["members"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
    },
  });

  return (
    <div>
      <PageHeader
        title="Đơn đăng ký thành viên"
        sub="Duyệt đơn để tạo tài khoản; người được duyệt sẽ nhận email thông báo."
      />
      <ErrorText>{act.error?.message}</ErrorText>

      {isLoading ? (
        <Spinner />
      ) : !data || data.items.length === 0 ? (
        <Empty>Không có đơn nào đang chờ duyệt.</Empty>
      ) : (
        <div className="space-y-3">
          {data.items.map((r) => (
            <Card key={r.id} className="px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {r.full_name} <span className="font-normal text-[var(--muted)]">· {r.email}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">Gửi lúc {dt(r.created_at)}</p>
                  {r.note && (
                    <p className="mt-2 border-l-4 border-[var(--brand-200)] bg-[var(--brand-50)] px-3 py-1.5 text-sm">
                      {r.note}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="warn">Chờ duyệt</Badge>
                  <Button disabled={act.isPending} onClick={() => act.mutate({ id: r.id, kind: "approve" })}>
                    Duyệt
                  </Button>
                  <Button variant="danger" disabled={act.isPending} onClick={() => act.mutate({ id: r.id, kind: "reject" })}>
                    Từ chối
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
