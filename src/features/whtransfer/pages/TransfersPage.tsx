import { useState } from 'react';
import { useNavigate } from '@/shared/router/compat';
import { Button, Card, DataTable, PageHeader, SimpleTable, StatusChip, type Column } from '@/shared/ui';
import { formatCases, formatDate, statusLabel } from '@/shared/lib';
import { useReplenishmentSuggestions, useTransfers } from '../hooks';
import { TransferDialog } from '../components/TransferDialog';
import type { ReplenishmentSuggestion, Transfer, TransferInput } from '../types';

export function TransfersPage() {
  const navigate = useNavigate();
  const query = useTransfers();
  const suggestions = useReplenishmentSuggestions();
  const [dialog, setDialog] = useState<{ initial?: Partial<TransferInput> } | null>(null);

  const columns: Column<Transfer>[] = [
    { key: 'code', header: 'Mã phiếu', width: '120px', render: (t) => <span className="bold">{t.code}</span> },
    { key: 'kind', header: 'Loại', width: '160px', render: (t) => <StatusChip domain="transferKind" value={t.kind} /> , text: (t) => statusLabel('transferKind', t.kind) },
    { key: 'route', header: 'Tuyến', text: (t) => `${t.fromWarehouseName} → ${t.toWarehouseName}` },
    { key: 'product', header: 'Sản phẩm', text: (t) => `${t.sku} · ${t.productName}` },
    { key: 'batch', header: 'Batch nguồn', text: (t) => t.sourceBatch },
    { key: 'qty', header: 'Số lượng', width: '100px', align: 'right', text: (t) => formatCases(t.qty) },
    { key: 'status', header: 'Trạng thái', width: '140px', render: (t) => <StatusChip domain="transfer" value={t.status} /> },
  ];
  const sug = suggestions.data ?? [];
  return (
    <>
      <PageHeader title="Điều chuyển kho" subtitle="Bổ sung tồn từ kho tổng cho kho vùng và các phiếu luân chuyển cận hạn đã được Admin duyệt." />
      {sug.length > 0 && (
        <Card title="Gợi ý bổ sung tồn kho vùng" flush>
          <SimpleTable<ReplenishmentSuggestion>
            rows={sug}
            columns={[
              { header: 'Kho vùng', cell: (s) => s.toWarehouseName },
              { header: 'SKU', cell: (s) => `${s.sku} · ${s.productName}` },
              { header: 'Đang có / tối thiểu', align: 'right', cell: (s) => `${s.have} / ${s.min}` },
              { header: 'Nguồn', cell: (s) => `${s.fromWarehouseName} · HSD ${formatDate(s.expiry)}` },
              { header: 'Gợi ý', align: 'right', cell: (s) => formatCases(s.qty) },
              { header: '', width: '110px', align: 'right', cell: (s) => <Button size="sm" variant="primary" onClick={() => setDialog({ initial: { fromWarehouse: s.fromWarehouse, toWarehouse: s.toWarehouse, sourceBatch: s.sourceBatch, qty: s.qty } })}>Tạo phiếu</Button> },
            ]}
          />
        </Card>
      )}
      <DataTable
        title="Phiếu điều chuyển"
        rows={query.data}
        loading={query.isLoading}
        error={query.error}
        rowKey={(t) => t.code}
        columns={columns}
        searchPlaceholder="Mã phiếu, kho, SKU, batch…"
        filters={[
          { label: 'Loại', options: ['Bổ sung', 'Luân chuyển cận hạn'], value: (t) => statusLabel('transferKind', t.kind) },
          { label: 'Trạng thái', options: ['Đang vận chuyển', 'Đã nhận', 'Đã hủy'], value: (t) => statusLabel('transfer', t.status) },
        ]}
        actions={<Button variant="primary" onClick={() => setDialog({})}>+ Tạo phiếu điều chuyển</Button>}
        onRowClick={(t) => navigate(`/whtransfer/${t.code}`)}
        rowActionsWidth="200px"
        rowActions={(t) => (
          <>
            <Button size="sm" onClick={() => navigate(`/whtransfer/${t.code}`)}>Xem</Button>
          </>
        )}
      />
      <TransferDialog open={!!dialog} initial={dialog?.initial} onClose={() => setDialog(null)} />
    </>
  );
}
