import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { Badge, Card, Empty, PageHeader, Spinner } from "../../components/ui";
import { dt } from "../../lib/format";

type Entry = { id: number; action: string; detail: string; user: string; created_at: string };

const ACTION_LABEL: Record<string, string> = {
  "period.create": "Tạo kỳ thu",
  "period.update": "Sửa kỳ thu",
  "period.delete": "Xóa kỳ thu",
  "period.remind": "Gửi nhắc đóng",
  "invoice.paid": "Ghi nhận đóng quỹ",
  "invoice.cancel": "Hủy hóa đơn",
  "expense.create": "Ghi khoản chi",
  "expense.delete": "Xóa khoản chi",
  "member.approve": "Duyệt thành viên",
  "member.reject": "Từ chối đơn",
  "member.update": "Sửa thành viên",
  "tx.ignore": "Bỏ qua giao dịch",
  "statement.import": "Nhập sao kê",
  "outflow.note": "Ghi chú chuyển đi",
};

const ACTION_TONE: Record<string, "ok" | "warn" | "bad" | "mute" | "brand"> = {
  "period.create": "ok",
  "period.delete": "bad",
  "expense.delete": "bad",
  "member.reject": "bad",
  "invoice.paid": "ok",
  "member.approve": "ok",
  "period.remind": "brand",
};

export default function Audit() {
  const { data, isLoading } = useQuery<{ items: Entry[] }>({
    queryKey: ["audit"],
    queryFn: () => api("/treasurer/audit"),
  });

  return (
    <div>
      <PageHeader
        title="Nhật ký thao tác"
        sub="Mọi thay đổi tiền quỹ đều được ghi lại để tra cứu và minh bạch."
      />
      {isLoading ? (
        <Spinner />
      ) : !data || data.items.length === 0 ? (
        <Empty>Chưa có thao tác nào được ghi.</Empty>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Thời điểm</th>
                  <th>Người thực hiện</th>
                  <th>Hành động</th>
                  <th>Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((a) => (
                  <tr key={a.id}>
                    <td className="num whitespace-nowrap text-sm">{dt(a.created_at)}</td>
                    <td className="whitespace-nowrap text-sm font-medium">{a.user}</td>
                    <td>
                      <Badge tone={ACTION_TONE[a.action] ?? "mute"}>
                        {ACTION_LABEL[a.action] ?? a.action}
                      </Badge>
                    </td>
                    <td className="mono max-w-96 truncate text-xs text-[var(--muted)]" title={a.detail}>
                      {a.detail}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
