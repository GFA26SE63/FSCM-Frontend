import { useParams } from '@/shared/router/compat';
import { Button, Callout, Card, Fields, PageHeader, QueryState, StatusChip } from '@/shared/ui';
import { formatCases, formatDate, formatDateTime, formatScore } from '@/shared/lib';
import { useReceiveTransfer, useTransfer } from '../hooks';

export function TransferDetailPage() {
  const { code = '' } = useParams();
  const query = useTransfer(code);
  const receive = useReceiveTransfer();
  return (
    <QueryState query={query}>
      {(t) => (
        <>
          <PageHeader
            back="/whtransfer"
            title={`Phiếu điều chuyển ${t.code}`}
            subtitle={`${t.fromWarehouseName} → ${t.toWarehouseName}`}
            chips={<><StatusChip domain="transfer" value={t.status} /><StatusChip domain="transferKind" value={t.kind} /></>}
            actions={t.status === 'InTransit' ? <Button variant="primary" loading={receive.isPending} onClick={() => receive.mutate(t.code)}>Xác nhận nhận (quét tem)</Button> : undefined}
          />
          {t.kind === 'NearExpiryRotation' && <Callout tone="info">Phiếu sinh từ đề xuất luân chuyển cận hạn đã được Admin duyệt{t.score != null ? ` (điểm S = ${formatScore(t.score)})` : ''}. Batch giữ nguyên HSD tại kho đích.</Callout>}
          {t.receivedNote && <Callout tone="ok">{t.receivedNote}</Callout>}
          <Card title="Thông tin">
            <Fields cols={3} items={[
              { label: 'Kho đi', value: `${t.fromWarehouseName} (${t.fromType === 'Central' ? 'Kho tổng' : 'Kho vùng'})` },
              { label: 'Kho đến', value: `${t.toWarehouseName} (${t.toType === 'Central' ? 'Kho tổng' : 'Kho vùng'})` },
              { label: 'Sản phẩm', value: `${t.sku} · ${t.productName}` },
              { label: 'Batch nguồn', value: t.sourceBatch },
              { label: 'Batch đích', value: t.destinationBatch },
              { label: 'HSD', value: formatDate(t.expiry) },
              { label: 'Số lượng', value: formatCases(t.qty) },
              { label: 'Tem', value: t.labelCode },
              { label: 'Tạo bởi', value: `${t.createdBy} · ${formatDateTime(t.createdAt)}` },
              { label: 'Thủ kho đi / đến', value: `${t.fromKeeper ?? '—'} / ${t.toKeeper ?? '—'}` },
              { label: 'Ghi chú', value: t.note || '—' },
            ]} />
          </Card>
        </>
      )}
    </QueryState>
  );
}
