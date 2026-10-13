import { useParams } from 'react-router-dom';
import { Card, Fields, PageHeader, QueryState, SimpleTable, StatusChip } from '@/shared/ui';
import { formatCases, formatDate, formatDateTime } from '@/shared/lib';
import { useReceipt } from '../hooks';

export function ReceiptDetailPage() {
  const { code = '' } = useParams();
  const query = useReceipt(code);
  return (
    <QueryState query={query}>
      {(r) => (
        <>
          <PageHeader back="/receipts" title={`Phiếu nhập ${r.code}`} subtitle={r.warehouseName} chips={<StatusChip domain="receipt" value="Posted" />} />
          <Card title="Thông tin">
            <Fields cols={3} items={[
              { label: 'Kho nhận', value: r.warehouseName },
              { label: 'Thời gian nhập', value: formatDateTime(r.receivedAt) },
              { label: 'Người nhập', value: r.receivedBy },
              { label: 'Tổng số lượng', value: formatCases(r.totalQty) },
              { label: 'Ghi chú', value: r.note || '—' },
            ]} />
          </Card>
          <Card title="Batch đã tạo" flush>
            <SimpleTable
              rows={r.lines}
              columns={[
                { header: 'SKU', width: '90px', cell: (l) => l.sku },
                { header: 'Sản phẩm', cell: (l) => l.productName },
                { header: 'Batch', cell: (l) => l.batchCode },
                { header: 'HSD', cell: (l) => formatDate(l.expiry) },
                { header: 'Lô NSX', cell: (l) => l.lot || '—' },
                { header: 'Số lượng', align: 'right', cell: (l) => formatCases(l.qty) },
                { header: 'Số tem', align: 'right', cell: (l) => l.labels },
              ]}
            />
          </Card>
        </>
      )}
    </QueryState>
  );
}
