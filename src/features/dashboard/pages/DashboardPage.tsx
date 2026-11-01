import { useState } from 'react';
import { useNavigate } from '@/shared/router/compat';
import { Card, PageHeader, QueryState, StatusChip, Stat } from '@/shared/ui';
import { formatMoney, formatNumber } from '@/shared/lib';
import { useDashboard } from '../hooks';
import { RevenueByDayChart } from '../components/RevenueChart';

/** "Dashboard" (Admin): KPIs, orders by status with progress bars, sales revenue ranking, top products, and revenue trend. */
export function DashboardPage() {
  const navigate = useNavigate();
  const [fromDate, setFromDate] = useState('2026-09-01');
  const [toDate, setToDate] = useState('2026-09-30');
  const [area, setArea] = useState('Tất cả');

  const q = useDashboard({ from: fromDate, to: toDate });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader
        title="Dashboard"
        subtitle={q.data ? `Từ ${fromDate} đến ${toDate} · doanh thu tính sau khuyến mãi & điều chỉnh` : undefined}
      />

      <section className="card" style={{ padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <label className="lbl" style={{ width: 180 }}>
          Từ ngày
          <input className="inp" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </label>
        <label className="lbl" style={{ width: 180 }}>
          Đến ngày
          <input className="inp" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </label>
        <label className="lbl" style={{ width: 200 }}>
          Khu vực
          <select className="inp" value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="Tất cả">Tất cả</option>
            <option value="Quận 12">Quận 12</option>
            <option value="Gò Vấp">Gò Vấp</option>
            <option value="Thủ Đức">Thủ Đức</option>
          </select>
        </label>
      </section>

      <QueryState query={q}>
        {(d) => {
          const maxStatusCount = Math.max(1, ...d.ordersByStatus.map((s) => s.count));
          const maxSalesRev = Math.max(1, ...d.revenueBySales.map((s) => s.afterPromo));
          const maxProdQty = Math.max(1, ...d.topProducts.map((p) => p.qty));

          return (
            <>
              {/* 4 KPI Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14 }}>
                <Stat
                  label="Tổng đơn tháng 9"
                  value={formatNumber(d.totalOrders)}
                  note="Bấm để mở danh sách đơn"
                  onClick={() => navigate('/orders')}
                />
                <Stat
                  label="Doanh thu (sau KM)"
                  value={formatMoney(d.revenueAfterPromo)}
                  color="var(--c-primary)"
                  note={`Trước KM: ${formatMoney(d.revenueBeforePromo)}`}
                  onClick={() => navigate('/kpi')}
                />
                <Stat
                  label="Đơn chờ duyệt"
                  value={d.pendingOrders}
                  color="var(--c-accent)"
                  note="Duyệt trước 12:00 để vào đợt hôm nay"
                  onClick={() => navigate('/orders')}
                />
                <Stat
                  label="Đơn thiếu hàng / từ chối"
                  value={d.rejectedOrders}
                  color="var(--c-danger)"
                  note="Kết thúc đợt, không giao một phần"
                  onClick={() => navigate('/orders')}
                />
              </div>

              {/* 2 Cards side by side: Orders by status & Sales revenue ranking */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
                <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h2 className="sec">Đơn hàng theo trạng thái</h2>
                    <span className="muted" style={{ fontSize: 12.5 }}>Bấm dòng để lọc đơn</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {d.ordersByStatus.map((b) => {
                      const pct = Math.round((b.count / maxStatusCount) * 100);
                      return (
                        <button
                          key={b.status}
                          type="button"
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '160px 1fr 40px',
                            gap: 10,
                            alignItems: 'center',
                            fontSize: 13,
                            border: 'none',
                            background: 'transparent',
                            padding: '4px 0',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            color: 'inherit',
                            textAlign: 'left',
                          }}
                          onClick={() => navigate('/orders')}
                        >
                          <span><StatusChip domain="order" value={b.status} /></span>
                          <div style={{ height: 14, background: '#EEF1EC', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: 4, background: '#14655B', width: `${pct}%` }} />
                          </div>
                          <span style={{ textAlign: 'right', fontWeight: 600 }}>{b.count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h2 className="sec">Doanh thu theo Sales (sau khuyến mãi)</h2>
                    <span className="muted" style={{ fontSize: 12.5 }}>Top nhân viên</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {d.revenueBySales.map((s) => {
                      const pct = Math.round((s.afterPromo / maxSalesRev) * 100);
                      return (
                        <div
                          key={s.name}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '150px 1fr 140px',
                            gap: 10,
                            alignItems: 'center',
                            fontSize: 13,
                          }}
                        >
                          <span style={{ fontWeight: 500 }}>{s.name}</span>
                          <div style={{ height: 14, background: '#EEF1EC', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: 4, background: '#1F4E79', width: `${pct}%` }} />
                          </div>
                          <span style={{ textAlign: 'right', display: 'flex', flexDirection: 'column' }}>
                            <strong style={{ color: '#14655B' }}>{formatMoney(s.afterPromo)}</strong>
                            <span className="muted" style={{ fontSize: 11 }}>Trước KM {formatMoney(s.beforePromo)}</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Top Products Table with rank badges & bars */}
              <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h2 className="sec">Sản phẩm bán chạy tháng 9 (theo số thùng)</h2>
                  <span className="muted" style={{ fontSize: 12.5 }}>Doanh thu tính sau khuyến mãi</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {d.topProducts.map((t) => {
                    const pct = Math.round((t.qty / maxProdQty) * 100);
                    return (
                      <div
                        key={t.sku}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '36px minmax(0, 2fr) minmax(0, 1.4fr) 110px 140px',
                          gap: 12,
                          alignItems: 'center',
                          fontSize: 13,
                          padding: '4px 0',
                        }}
                      >
                        <span style={{ fontWeight: 700, color: '#14655B', fontSize: 14 }}>#{t.rank}</span>
                        <span style={{ fontWeight: 600 }}>{t.productName} <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>({t.sku})</span></span>
                        <div style={{ height: 10, background: '#F4EDE6', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 4, background: '#14655B', width: `${pct}%` }} />
                        </div>
                        <span style={{ textAlign: 'right', fontWeight: 600 }}>{formatNumber(t.qty)} thùng</span>
                        <span style={{ textAlign: 'right', fontWeight: 700, color: '#14655B' }}>{formatMoney(t.revenueAfterPromo)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Revenue Trend Chart */}
              <Card title="Biểu đồ xu hướng doanh thu theo ngày">
                <RevenueByDayChart days={d.revenueByDay} />
              </Card>
            </>
          );
        }}
      </QueryState>
    </div>
  );
}
