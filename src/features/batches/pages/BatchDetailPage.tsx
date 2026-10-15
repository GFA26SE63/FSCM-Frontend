import { useParams } from '@/shared/router/compat';
import { Callout, Card, Fields, PageHeader, QueryState, SimpleTable, StatusChip } from '@/shared/ui';
import { formatCases, formatDate, formatDateTime } from '@/shared/lib';
import { useBatch } from '../hooks';

export function BatchDetailPage() {
  const { code = '' } = useParams();
  const query = useBatch(code);
  return (
    <QueryState query={query}>
      {(b) => (
        <>
          <PageHeader back="/batches" title={`Batch ${b.code}`} subtitle={`${b.sku} · ${b.productName} · ${b.warehouseName}`} chips={<StatusChip domain="expiry" value={b.expiryStatus} />} />
          {b.discountPct != null && <Callout tone="info">Đang áp dụng giảm giá {b.discountPct}% ({b.discountCode}) đến {formatDate(b.discountUntil)}.</Callout>}
          <Card title="Thông tin">
            <Fields cols={3} items={[
              { label: 'Kho', value: b.warehouseName },
              { label: 'HSD', value: formatDate(b.expiry) },
              { label: 'HSD còn lại', value: `${b.remainingDays} ngày (${b.remainingPct}% / ${b.shelfLifeDays} ngày)` },
              { label: 'Tồn kho', value: formatCases(b.onHand) },
              { label: 'Đang giữ (held / reserved)', value: formatCases(b.held) },
              { label: 'Khả dụng', value: formatCases(b.available) },
            ]} />
          </Card>
          <Card title="Lịch sử nhập / xuất" flush>
            <SimpleTable
              rows={b.history}
              columns={[
                { header: 'Thời gian', cell: (h) => formatDateTime(h.at) },
                { header: 'Loại', cell: (h) => h.type },
                { header: 'Chứng từ', cell: (h) => h.document },
                { header: 'Số lượng', align: 'right', cell: (h) => (h.qty > 0 ? '+' : '') + h.qty },
                { header: 'Người thực hiện', cell: (h) => h.by },
              ]}
            />
          </Card>
        </>
      )}
    </QueryState>
  );
}
