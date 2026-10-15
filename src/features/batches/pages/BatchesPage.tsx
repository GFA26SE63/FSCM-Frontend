import { useNavigate } from '@/shared/router/compat';
import { Button, DataTable, PageHeader, StatusChip, type Column } from '@/shared/ui';
import { formatDate, statusLabels } from '@/shared/lib';
import { useBatches } from '../hooks';
import type { Batch } from '../types';

export function BatchesPage() {
  const navigate = useNavigate();
  const query = useBatches();
  const rows = query.data ?? [];
  const columns: Column<Batch>[] = [
    { key: 'code', header: 'Batch', width: '200px', render: (b) => <span className="bold">{b.code}</span> },
    { key: 'wh', header: 'Kho', width: '130px', text: (b) => b.warehouseName },
    { key: 'product', header: 'Sản phẩm', text: (b) => `${b.sku} · ${b.productName}` },
    { key: 'expiry', header: 'HSD', width: '95px', text: (b) => formatDate(b.expiry) },
    { key: 'remain', header: 'Còn lại', width: '120px', align: 'right', text: (b) => (b.expiryStatus === 'Disposed' ? '—' : `${b.remainingDays} ngày (${b.remainingPct}%)`) },
    { key: 'onHand', header: 'Tồn', width: '70px', align: 'right', text: (b) => b.onHand },
    { key: 'held', header: 'Giữ', width: '65px', align: 'right', text: (b) => b.held },
    { key: 'avail', header: 'Khả dụng', width: '85px', align: 'right', text: (b) => b.available },
    { key: 'disc', header: 'Giảm giá', width: '85px', align: 'right', text: (b) => (b.discountPct ? `${b.discountPct}%` : '—') },
    { key: 'status', header: 'Tình trạng', width: '115px', render: (b) => <StatusChip domain="expiry" value={b.expiryStatus} /> },
  ];
  return (
    <>
      <PageHeader title="Quản lý batch" subtitle="Tồn theo kho – SKU – hạn sử dụng. Khả dụng = tồn − tạm giữ / Reserved." />
      <DataTable
        title="Danh sách batch"
        rows={rows}
        loading={query.isLoading}
        error={query.error}
        rowKey={(b) => b.code}
        columns={columns}
        searchPlaceholder="Mã batch, SKU, sản phẩm…"
        filters={[
          { label: 'Kho', options: [...new Set(rows.map((b) => b.warehouseName))], value: (b) => b.warehouseName },
          { label: 'Tình trạng HSD', options: Object.values(statusLabels.expiry), value: (b) => statusLabels.expiry[b.expiryStatus] },
        ]}
        onRowClick={(b) => navigate(`/batches/${b.code}`)}
        rowActionsWidth="90px"
        rowActions={(b) => <Button size="sm" onClick={() => navigate(`/batches/${b.code}`)}>Xem</Button>}
      />
    </>
  );
}
