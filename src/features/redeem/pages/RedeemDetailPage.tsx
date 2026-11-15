import { useParams } from '@/shared/router/compat';
import { Callout, Card, Fields, PageHeader, QueryState, StatusChip } from '@/shared/ui';
import { formatNumber } from '@/shared/lib';
import { formatInstantDateTime } from '@/shared/lib/dates';
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
              { label: 'Số lượng', value: x.quantity == null ? 'Chưa lưu (yêu cầu cũ)' : formatNumber(x.quantity) },
              { label: 'Điểm đổi', value: formatNumber(x.points) },
              { label: 'Điểm khả dụng / đang giữ hiện tại', value: `${formatNumber(x.available)} / ${x.held == null ? '—' : formatNumber(x.held)}` },
              { label: 'Ngày yêu cầu', value: formatInstantDateTime(x.requestedAt) },
              { label: 'Cập nhật gần nhất', value: formatInstantDateTime(x.updatedAt) },
            ]} />
          </Card>
        </>
      )}
    </QueryState>
  );
}
