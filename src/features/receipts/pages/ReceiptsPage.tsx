import { useNavigate } from '@/shared/router/compat';
import { Button, DataTable, PageHeader, StatusChip, type Column } from '@/shared/ui';
import { formatCases, formatDateTime } from '@/shared/lib';
import { useReceipts } from '../hooks';
import type { Receipt } from '../types';

const totalQuantity = (receipt: Receipt) => receipt.lines.reduce((sum, line) => sum + line.receivedQuantity, 0);

export function ReceiptsPage() {
  const navigate = useNavigate();
  const query = useReceipts();
  const columns: Column<Receipt>[] = [
    { key: 'code', header: 'Mã phiếu', width: '130px', render: (r) => <span className="bold">{r.receiptCode}</span> },
    { key: 'wh', header: 'Kho nhận', text: (r) => `${r.warehouseCode} ${r.warehouseName}` },
    { key: 'at', header: 'Thời gian', width: '150px', text: (r) => formatDateTime(r.receivedAt ?? r.createdAt) },
    { key: 'batches', header: 'Số dòng', width: '90px', align: 'right', text: (r) => r.lines.length },
    { key: 'qty', header: 'Tổng SL', width: '110px', align: 'right', text: (r) => formatCases(totalQuantity(r)) },
    { key: 'status', header: 'Trạng thái', width: '110px', render: (r) => <StatusChip domain="receipt" value={r.status} /> },
  ];
  return (
    <>
      <PageHeader title="Nhập kho" subtitle="Tạo phiếu chờ duyệt; chỉ phiếu đã duyệt mới sinh/ghép batch và tăng tồn kho." />
      <DataTable
        title="Phiếu nhập kho"
        rows={query.data}
        loading={query.isLoading}
        error={query.error}
        rowKey={(r) => r.id}
        columns={columns}
        searchPlaceholder="Mã phiếu, kho, SKU…"
        filters={[{ label: 'Kho', options: [...new Set((query.data ?? []).map((r) => r.warehouseName))], value: (r) => r.warehouseName }]}
        actions={<Button variant="primary" onClick={() => navigate('/receipts/new')}>+ Tạo phiếu nhập</Button>}
        onRowClick={(r) => navigate(`/receipts/${r.id}`)}
        rowActionsWidth="100px"
        rowActions={(r) => <Button size="sm" onClick={() => navigate(`/receipts/${r.id}`)}>Xem</Button>}
      />
    </>
  );
}
