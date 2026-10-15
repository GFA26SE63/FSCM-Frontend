import { useNavigate } from '@/shared/router/compat';
import { Button, Card, PageHeader, QueryState, SimpleTable, Stat, StatusChip } from '@/shared/ui';
import { formatMoney, formatNumber } from '@/shared/lib';
import { useDashboard } from '../hooks';
import { RevenueByDayChart, RevenueBySalesChart } from '../components/RevenueChart';

/** "Dashboard" (Admin): orders, revenue after promotion, Sales ranking, top products – same figures as KPI / ranking screens. */
export function DashboardPage() {
  const navigate = useNavigate();
  const q = useDashboard({});
  return (
    <>
      <PageHeader title="Dashboard" subtitle={q.data ? `Từ ${q.data.from} đến ${q.data.to} · doanh thu tính sau khuyến mãi` : undefined} />
      <QueryState query={q}>
        {(d) => (
          <>
            <div className="grid-4">
              <Stat label="Doanh thu sau KM" value={formatMoney(d.revenueAfterPromo)} note={`Trước KM ${formatMoney(d.revenueBeforePromo)}`} />
              <Stat label="Tổng đơn" value={formatNumber(d.totalOrders)} />
              <Stat label="Chờ duyệt" value={d.pendingOrders} note="Bấm Đơn hàng để duyệt" color="#B26B00" />
              <Stat label="Bị từ chối" value={d.rejectedOrders} color="#B42318" />
            </div>
            <div className="grid-aside" style={{ marginTop: 14 }}>
              <Card title="Doanh thu theo ngày">
                <RevenueByDayChart days={d.revenueByDay} />
              </Card>
              <Card title="Đơn theo trạng thái" flush actions={<Button size="sm" onClick={() => navigate('/orders')}>Xem đơn</Button>}>
                <SimpleTable
                  rows={d.ordersByStatus}
                  columns={[
                    { header: 'Trạng thái', cell: (s) => <StatusChip domain="order" value={s.status} /> },
                    { header: 'Số đơn', align: 'right', cell: (s) => s.count },
                  ]}
                />
              </Card>
            </div>
            <div className="grid-2" style={{ marginTop: 14 }}>
              <Card title="Top Sales (doanh thu sau KM)">
                <RevenueBySalesChart rows={d.revenueBySales} />
              </Card>
              <Card title="Sản phẩm bán chạy" flush>
                <SimpleTable
                  rows={d.topProducts.slice(0, 6)}
                  columns={[
                    { header: '#', width: '40px', cell: (p) => p.rank },
                    { header: 'Sản phẩm', cell: (p) => `${p.sku} · ${p.productName}` },
                    { header: 'Thùng', align: 'right', cell: (p) => formatNumber(p.qty) },
                    { header: 'Doanh thu sau KM', align: 'right', cell: (p) => formatMoney(p.revenueAfterPromo) },
                  ]}
                />
              </Card>
            </div>
          </>
        )}
      </QueryState>
    </>
  );
}
