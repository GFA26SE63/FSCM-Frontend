import { useParams } from '@/shared/router/compat';
import { Callout, Card, Fields, PageHeader, QueryState, StatusChip } from '@/shared/ui';
import { formatDateTime, formatNumber } from '@/shared/lib';
import { useRedemption } from '../hooks';
import { RedeemActions } from '../components/RedeemActions';

const flow = ['Requested', 'Approved', 'Delivered', 'Done'] as const;

export function RedeemDetailPage() {
  const { code = '' } = useParams();
  const query = useRedemption(code);
  return (
    <QueryState query={query}>
      {(x) => (
        <>
          <PageHeader back="/redeem" title={`Yêu cầu ${x.code}`} subtitle={`${x.retailerName} · ${x.giftName}`} chips={<StatusChip domain="gift" value={x.status} />} actions={<RedeemActions x={x} size="md" />} />
          {x.status === 'Requested' && x.available < x.points && <Callout tone="warn">Điểm khả dụng ({formatNumber(x.available)}) thấp hơn điểm cần đổi ({formatNumber(x.points)}).</Callout>}
          {x.status === 'Rejected' && <Callout tone="danger">Yêu cầu bị từ chối; điểm đang giữ đã trả lại retailer.</Callout>}
          <Card title="Tiến trình">
            <div className="row-wrap">
              {flow.map((s, i) => (
                <span key={s} className="row">
                  <StatusChip domain="gift" value={s} />
                  {i < flow.length - 1 && <span className="muted">→</span>}
                </span>
              ))}
            </div>
          </Card>
          <Card title="Thông tin">
            <Fields cols={3} items={[
              { label: 'Retailer', value: `${x.retailerName} (${x.retailerCode})` },
              { label: 'Quà', value: `${x.giftCode} · ${x.giftName}` },
              { label: 'Điểm đổi', value: formatNumber(x.points) },
              { label: 'Số dư / đang giữ / khả dụng', value: `${formatNumber(x.balance)} / ${formatNumber(x.held)} / ${formatNumber(x.available)}` },
              { label: 'Ngày yêu cầu', value: formatDateTime(x.requestedAt) },
              { label: 'Xử lý gần nhất', value: x.handledNote || '—' },
            ]} />
          </Card>
        </>
      )}
    </QueryState>
  );
}
