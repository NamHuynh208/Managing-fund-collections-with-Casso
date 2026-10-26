import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { Card, CardHeader, Empty, Spinner, StatCard } from "../../components/ui";
import { month, vnd, vndShort } from "../../lib/format";

type Overview = {
  balance: number;
  collected: number;
  spent: number;
  review_count: number;
  unpaid_count: number;
  member_count: number;
  monthly: { month: string; collected: number; spent: number }[];
};

/** Biểu đồ cột đôi thu/chi thuần CSS — màu phẳng, không gradient. */
function MonthlyChart({ data }: { data: Overview["monthly"] }) {
  const max = Math.max(1, ...data.flatMap((d) => [d.collected, d.spent]));
  return (
    <div className="flex items-end justify-between gap-2 px-5 pb-5 pt-6 sm:gap-4">
      {data.map((d) => (
        <div key={d.month} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
          <div className="flex h-36 w-full items-end justify-center gap-1">
            <div
              className="w-full max-w-6 bg-[var(--brand-700)]"
              style={{ height: `${Math.max(2, (d.collected / max) * 100)}%` }}
              title={`Thu: ${vnd(d.collected)}`}
            />
            <div
              className="w-full max-w-6 bg-[#8aa294]"
              style={{ height: `${Math.max(2, (d.spent / max) * 100)}%` }}
              title={`Chi: ${vnd(d.spent)}`}
            />
          </div>
          <span className="text-[11px] font-semibold text-[var(--muted)]">{month(d.month)}</span>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { data, isLoading } = useQuery<Overview>({
    queryKey: ["overview"],
    queryFn: () => api("/treasurer/overview"),
  });

  if (isLoading) return <Spinner />;
  if (!data) return <Empty>Không tải được dữ liệu.</Empty>;

  return (
    <div>
      <div className="mb-5">
        <p className="label-caps">Khu thủ quỹ</p>
        <h1 className="text-2xl font-bold tracking-tight">Bảng điều khiển</h1>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Quỹ hiện có" value={vnd(data.balance)} hint={`Đầu kỳ + thu − chi`} tone="ok" />
        <StatCard label="Tổng đã thu" value={vnd(data.collected)} hint="Toàn bộ các kỳ" />
        <StatCard label="Tổng đã chi" value={vnd(data.spent)} hint="Khoản chi đã ghi nhận" />
        <StatCard
          label="Cần xử lý"
          value={`${data.review_count} gd · ${data.unpaid_count} hd`}
          hint="Giao dịch chờ + hóa đơn chưa đóng"
          tone={data.review_count > 0 ? "warn" : "default"}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[3fr_2fr]">
        <Card>
          <CardHeader
            title="Thu / chi theo tháng"
            sub="6 tháng gần nhất"
            right={
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 bg-[var(--brand-700)]" /> Thu
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 bg-[#8aa294]" /> Chi
                </span>
              </div>
            }
          />
          <MonthlyChart data={data.monthly} />
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Việc cần làm" />
            <div className="divide-y divide-[var(--border)]">
              <Link to="/thu-quy/giao-dich" className="flex items-center justify-between px-5 py-3.5 no-underline hover:bg-[var(--brand-50)]">
                <span className="text-sm font-medium">Giao dịch đang chờ xử lý</span>
                <span className={`num border px-2 py-0.5 text-sm font-bold ${data.review_count > 0 ? "border-[var(--warn-fg)] bg-[var(--warn-bg)] text-[var(--warn-fg)]" : "border-[var(--border)] text-[var(--muted)]"}`}>
                  {data.review_count}
                </span>
              </Link>
              <Link to="/thu-quy/dang-ky" className="flex items-center justify-between px-5 py-3.5 no-underline hover:bg-[var(--brand-50)]">
                <span className="text-sm font-medium">Đơn đăng ký chờ duyệt</span>
                <span className="num border border-[var(--border)] px-2 py-0.5 text-sm font-bold text-[var(--muted)]">
                  xem
                </span>
              </Link>
              <div className="flex items-center justify-between px-5 py-3.5">
                <span className="text-sm font-medium">Hóa đơn chưa đóng</span>
                <span className="num text-sm font-bold">{data.unpaid_count}</span>
              </div>
              <div className="flex items-center justify-between px-5 py-3.5">
                <span className="text-sm font-medium">Thành viên đang hoạt động</span>
                <span className="num text-sm font-bold">{data.member_count}</span>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Thao tác nhanh" />
            <div className="grid grid-cols-2 gap-px bg-[var(--border)]">
              {[
                ["/thu-quy/ky", "+ Tạo kỳ thu"],
                ["/thu-quy/chi-tieu", "+ Ghi khoản chi"],
                ["/thu-quy/lich-su", "Lịch sử giao dịch"],
                ["/thu-quy/nhat-ky", "Nhật ký thao tác"],
              ].map(([to, label]) => (
                <Link
                  key={to}
                  to={to}
                  className="bg-white px-4 py-3.5 text-center text-sm font-semibold text-[var(--brand-800)] no-underline hover:bg-[var(--brand-50)]"
                >
                  {label}
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Card className="mt-4">
        <CardHeader title="Diễn biến quỹ" sub="Tổng quan nhanh 6 tháng" />
        <div className="divide-y divide-[var(--border)]">
          {data.monthly
            .slice()
            .reverse()
            .map((m) => {
              const net = m.collected - m.spent;
              return (
                <div key={m.month} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                  <span className="w-16 font-semibold">{month(m.month)}</span>
                  <span className="num flex-1 text-right text-[var(--muted)]">
                    thu {vndShort(m.collected)} − chi {vndShort(m.spent)}
                  </span>
                  <span className={`num w-20 text-right font-bold ${net >= 0 ? "text-[var(--brand-700)]" : "text-[var(--bad-fg)]"}`}>
                    {net >= 0 ? "+" : "−"}
                    {vndShort(Math.abs(net))}
                  </span>
                </div>
              );
            })}
        </div>
      </Card>
    </div>
  );
}
