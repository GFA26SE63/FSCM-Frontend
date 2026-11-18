import { useParams } from '@/shared/router/compat';
import { Card, Fields, PageHeader, QueryState, StatusChip } from '@/shared/ui';
import { formatNumber } from '@/shared/lib';
import { formatInstantDateTime } from '@/shared/lib/dates';
import { useRedemption } from '../hooks';
import { RedeemActions } from '../components/RedeemActions';


export function RedeemDetailPage() {
  const { code = '' } = useParams();
  const query = useRedemption(code);
  return (
    <QueryState query={query}>
      {(x) => (
        <>
          <PageHeader back="/redeem" title={`Yêu cầu ${x.code}`} subtitle={`${x.retailerName} · ${x.giftName}`} chips={<StatusChip domain="gift" value={x.status} />} actions={<RedeemActions x={x} size="md" />} />
          <Card title="Thông tin">
            <Fields cols={3} items={[
              { label: 'Điểm bán', value: `${x.retailerName} (${x.retailerCode})` },
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
