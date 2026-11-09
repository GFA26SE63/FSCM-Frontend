import { useParams } from '@/shared/router/compat';
import { Button, Card, Fields, PageHeader, QueryState, SimpleTable, StatusChip } from '@/shared/ui';
import { formatCases, formatDate, formatDateTime } from '@/shared/lib';
import { useApproveReceipt, useReceipt } from '../hooks';

export function ReceiptDetailPage() {
  const { code: id = '' } = useParams();
  const query = useReceipt(id);
  const approve = useApproveReceipt();
  return (
    <QueryState query={query}>
      {(receipt) => {
        const total = receipt.lines.reduce((sum, line) => sum + line.receivedQuantity, 0);
        return (
          <>
            <PageHeader
              back="/receipts"
              title={`Phiếu nhập ${receipt.receiptCode}`}
              subtitle={`${receipt.warehouseCode} · ${receipt.warehouseName}`}
              chips={<StatusChip domain="receipt" value={receipt.status} />}
              actions={receipt.status === 'Pending' ? (
                <Button variant="primary" loading={approve.isPending} onClick={() => approve.mutate(receipt.id)}>
                  Duyệt và cộng tồn
                </Button>
              ) : undefined}
            />
            <Card title="Thông tin">
              <Fields cols={3} items={[
                { label: 'Kho nhận', value: `${receipt.warehouseCode} · ${receipt.warehouseName}` },
                { label: 'Ngày tạo', value: formatDateTime(receipt.createdAt) },
                { label: 'Thời gian duyệt', value: receipt.approvedAt ? formatDateTime(receipt.approvedAt) : '—' },
                { label: 'Tổng số lượng', value: formatCases(total) },
                { label: 'Người tạo', value: `${receipt.createdByUserId.slice(0, 8)}…` },
              ]} />
            </Card>
            <Card title={receipt.status === 'Received' ? 'Batch đã tạo' : 'Dòng hàng chờ duyệt'} flush>
              <SimpleTable
                rows={receipt.lines}
                columns={[
                  { header: 'SKU', width: '90px', cell: (line) => line.sku },
                  { header: 'Sản phẩm', cell: (line) => line.productName },
                  { header: 'Mã lô NSX', cell: (line) => line.sourceLotCode || '—' },
                  { header: 'NSX', cell: (line) => formatDate(line.productionDate) },
                  { header: 'HSD', cell: (line) => formatDate(line.expirationDate) },
                  { header: 'Số lượng', align: 'right', cell: (line) => formatCases(line.receivedQuantity) },
                  { header: 'Batch', cell: (line) => line.batchCode || 'Sinh khi duyệt' },
                ]}
              />
            </Card>
          </>
        );
      }}
    </QueryState>
  );
}
