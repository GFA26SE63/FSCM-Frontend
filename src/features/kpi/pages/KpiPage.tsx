import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, DataTable, PageHeader, SimpleTable, Stat, StatusChip, Tabs, type Column } from '@/shared/ui';
import { formatMoney, formatNumber, statusLabel } from '@/shared/lib';
import { useKpiSales, useProductRanking } from '../hooks';
import type { KpiRow } from '../types';

/** "KPI Sales" – ranking by revenue after promotion vs target, plus the product ranking. */
export function KpiPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'sales' | 'products'>('sales');
  const kpi = useKpiSales();
  const products = useProductRanking();
  const rows = kpi.data?.items ?? [];
  const columns: Column<KpiRow>[] = [
    { key: 'rank', header: '#', width: '50px', align: 'right', text: (r) => r.rank },
    { key: 'name', header: 'Sales', render: (r) => <span className="strong">{r.name}</span> },
    { key: 'group', header: 'Nhóm', width: '90px', text: (r) => r.group },
    { key: 'after', header: 'Doanh thu sau KM', width: '150px', align: 'right', text: (r) => formatMoney(r.after) },
    { key: 'target', header: 'Mục tiêu', width: '140px', align: 'right', text: (r) => formatMoney(r.target) },
    { key: 'pct', header: '% đạt', width: '80px', align: 'right', text: (r) => `${r.achievedPct}%` },
    { key: 'orders', header: 'Đơn', width: '70px', align: 'right', text: (r) => r.orders },
    { key: 'stores', header: 'Điểm bán', width: '90px', align: 'right', text: (r) => `${r.stores} (+${r.newStores})` },
    { key: 'result', header: 'Kết quả', width: '110px', render: (r) => <StatusChip domain="kpi" value={r.result} /> },
  ];
  return (
    <>
      <PageHeader title="KPI Sales" subtitle={`Kỳ ${kpi.data?.period ?? '—'} – xếp hạng theo doanh thu sau khuyến mãi so với mục tiêu.`} />
      <div className="grid-3">
        <Stat label="Tổng doanh thu sau KM" value={formatMoney(rows.reduce((a, r) => a + r.after, 0))} />
        <Stat label="Sales đạt KPI" value={`${rows.filter((r) => r.result === 'Achieved').length} / ${rows.length}`} />
        <Stat label="Điểm bán mới" value={rows.reduce((a, r) => a + r.newStores, 0)} />
      </div>
      <Tabs value={tab} onChange={setTab} items={[{ key: 'sales', label: 'Xếp hạng Sales' }, { key: 'products', label: 'Xếp hạng sản phẩm' }]} />
      {tab === 'sales' ? (
        <DataTable
          title="Xếp hạng Sales"
          rows={rows}
          loading={kpi.isLoading}
          error={kpi.error}
          rowKey={(r) => r.name}
          columns={columns}
          searchPlaceholder="Tên Sales, nhóm…"
          filters={[{ label: 'Kết quả', options: ['Đạt', 'Chưa đạt'], value: (r) => statusLabel('kpi', r.result) }]}
          onRowClick={(r) => navigate(`/kpi/${encodeURIComponent(r.name)}`)}
          rowActionsWidth="90px"
          rowActions={(r) => <Button size="sm" onClick={() => navigate(`/kpi/${encodeURIComponent(r.name)}`)}>Xem</Button>}
        />
      ) : (
        <Card title="Sản phẩm bán chạy" flush>
          <SimpleTable
            rows={products.data?.items ?? []}
            columns={[
              { header: '#', width: '50px', cell: (p) => p.rank },
              { header: 'SKU', cell: (p) => p.sku },
              { header: 'Sản phẩm', cell: (p) => p.productName },
              { header: 'Số lượng (thùng)', align: 'right', cell: (p) => formatNumber(p.qty) },
              { header: 'Doanh thu sau KM', align: 'right', cell: (p) => formatMoney(p.revenueAfterPromo) },
            ]}
          />
        </Card>
      )}
    </>
  );
}
