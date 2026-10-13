import { useParams } from 'react-router-dom';
import { Card, Fields, PageHeader, QueryState, SimpleTable, StatusChip } from '@/shared/ui';
import { formatCases, formatDate, formatDateTime, formatMoney } from '@/shared/lib';
import { useDisposal } from '../hooks';

export function DisposalDetailPage() {
  const { code = '' } = useParams();
  const query = useDisposal(code);
  return (
    <QueryState query={query}>
      {(d) => (
        <>
          <PageHeader back="/disposal" title={`Phiếu hủy ${d.code}`} subtitle={d.warehouseName} chips={<StatusChip domain="disposal" value="Disposed" />} />
          <Card title="Thông tin">
            <Fields cols={3} items={[
              { label: 'Kho', value: d.warehouseName },
              { label: 'Thời gian', value: formatDateTime(d.createdAt) },
              { label: 'Người lập', value: d.createdBy },
              { label: 'Lý do', value: d.reason },
              { label: 'Hình thức', value: d.method },
              { label: 'Tổng SL / giá trị', value: `${formatCases(d.totalQty)} · ${formatMoney(d.totalValue)}` },
            ]} />
          </Card>
          <Card title="Batch đã hủy" flush>
            <SimpleTable
              rows={d.lines}
              columns={[
                { header: 'Batch', cell: (l) => l.batchCode },
                { header: 'SKU', cell: (l) => `${l.sku} · ${l.productName}` },
                { header: 'HSD', cell: (l) => formatDate(l.expiry) },
                { header: 'Số lượng', align: 'right', cell: (l) => formatCases(l.qty) },
              ]}
            />
          </Card>
        </>
      )}
    </QueryState>
  );
}
