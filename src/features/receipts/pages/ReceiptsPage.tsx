import { useNavigate } from 'react-router-dom';
import { Button, DataTable, PageHeader, StatusChip, type Column } from '@/shared/ui';
import { formatCases, formatDateTime } from '@/shared/lib';
import { useReceipts } from '../hooks';
import type { Receipt } from '../types';

export function ReceiptsPage() {
  const navigate = useNavigate();
  const query = useReceipts();
  const columns: Column<Receipt>[] = [
    { key: 'code', header: 'Mã phiếu', width: '130px', render: (r) => <span className="bold">{r.code}</span> },
    { key: 'wh', header: 'Kho nhận', text: (r) => r.warehouseName },
    { key: 'at', header: 'Thời gian nhập', width: '150px', text: (r) => formatDateTime(r.receivedAt) },
    { key: 'by', header: 'Người nhập', width: '150px', text: (r) => r.receivedBy },
    { key: 'batches', header: 'Số batch', width: '90px', align: 'right', text: (r) => r.batchCount },
    { key: 'qty', header: 'Tổng SL', width: '110px', align: 'right', text: (r) => formatCases(r.totalQty) },
    { key: 'status', header: 'Trạng thái', width: '110px', render: () => <StatusChip domain="receipt" value="Posted" /> },
  ];
  return (
    <>
      <PageHeader title="Nhập kho" subtitle="Nhập hàng từ nhà sản xuất: mỗi dòng sinh batch {kho}-{SKU}-{HSD} và tem in sẵn." />
      <DataTable
        title="Phiếu nhập kho"
        rows={query.data}
        loading={query.isLoading}
        error={query.error}
        rowKey={(r) => r.code}
        columns={columns}
        searchPlaceholder="Mã phiếu, kho, batch…"
        filters={[{ label: 'Kho', options: [...new Set((query.data ?? []).map((r) => r.warehouseName))], value: (r) => r.warehouseName }]}
        actions={<Button variant="primary" onClick={() => navigate('/receipts/new')}>+ Tạo phiếu nhập</Button>}
        onRowClick={(r) => navigate(`/receipts/${r.code}`)}
        rowActionsWidth="100px"
        rowActions={(r) => <Button size="sm" onClick={() => navigate(`/receipts/${r.code}`)}>Xem</Button>}
      />
    </>
  );
}
