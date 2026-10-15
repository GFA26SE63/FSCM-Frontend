import { useParams } from '@/shared/router/compat';
import { Card, Chip, Fields, PageHeader, QueryState, SimpleTable, StatusChip } from '@/shared/ui';
import { formatDate, formatNumber } from '@/shared/lib';
import { useRetailerLoyalty } from '../hooks';

const kindLabel = { Earned: 'Đã cộng', Pending: 'Chờ cộng', Redeemed: 'Đổi quà', Refunded: 'Hoàn điểm' } as const;
const kindTone = { Earned: 'ok', Pending: 'warn', Redeemed: 'violet', Refunded: 'info' } as const;

export function LoyaltyDetailPage() {
  const { code = '' } = useParams();
  const query = useRetailerLoyalty(code);
  return (
    <QueryState query={query}>
      {(l) => (
        <>
          <PageHeader back="/loyalty" title={`${l.retailerCode} · ${l.retailerName}`} subtitle={`${l.programCode} · ${l.programName}`} />
          <Card>
            <Fields cols={3} items={[
              { label: 'Số dư điểm', value: formatNumber(l.balance) },
              { label: 'Đang giữ (chờ duyệt đổi quà)', value: formatNumber(l.held) },
              { label: 'Khả dụng', value: formatNumber(l.available) },
              { label: 'Đơn chờ cộng điểm', value: l.pendingOrders },
              { label: 'Điểm hết hạn', value: formatDate(l.pointsExpireOn) },
            ]} />
          </Card>
          <Card title="Sổ điểm" flush>
            <SimpleTable
              rows={l.ledger}
              empty="Chưa phát sinh điểm."
              columns={[
                { header: 'Ngày', width: '110px', cell: (e) => formatDate(e.date) },
                { header: 'Nội dung', cell: (e) => e.description },
                { header: 'Loại', width: '110px', cell: (e) => <Chip tone={kindTone[e.kind]}>{kindLabel[e.kind]}</Chip> },
                { header: 'Điểm', width: '90px', align: 'right', cell: (e) => (e.points == null ? '—' : (e.points > 0 ? '+' : '') + formatNumber(e.points)) },
              ]}
            />
          </Card>
          <Card title="Yêu cầu đổi quà" flush>
            <SimpleTable
              rows={l.redemptions}
              empty="Chưa có yêu cầu đổi quà."
              columns={[
                { header: 'Mã', cell: (x) => x.code },
                { header: 'Quà', cell: (x) => `${x.giftCode} · ${x.giftName}` },
                { header: 'Điểm', align: 'right', cell: (x) => formatNumber(x.points) },
                { header: 'Ngày yêu cầu', cell: (x) => formatDate(x.requestedAt) },
                { header: 'Trạng thái', cell: (x) => <StatusChip domain="gift" value={x.status} /> },
              ]}
            />
          </Card>
        </>
      )}
    </QueryState>
  );
}
