import { useParams } from '@/shared/router/compat';
import { Callout, Card, Chip, Fields, PageHeader, QueryState, SimpleTable, StatusChip } from '@/shared/ui';
import { Link } from 'react-router-dom';
import { formatNumber } from '@/shared/lib';
import { formatInstantDate } from '@/shared/lib/dates';
import { useRetailerLoyalty } from '../hooks';

const kindLabel: Record<string, string> = { Earned: 'Đã cộng', Pending: 'Chờ cộng', PendingEarn: 'Chờ cộng', PendingEarnCancelled: 'Hủy điểm chờ', EarnedAdjusted: 'Điều chỉnh điểm tích', RedemptionHeld: 'Giữ điểm đổi quà', RedemptionRejected: 'Hoàn điểm do từ chối', RedemptionCompleted: 'Hoàn tất đổi quà', Expired: 'Điểm hết hạn', Redeemed: 'Đổi quà', Refunded: 'Hoàn điểm' };

export function LoyaltyDetailPage() {
  const { code = '' } = useParams();
  const query = useRetailerLoyalty(code);
  return (
    <QueryState query={query}>
      {(l) => (
        <>
          <PageHeader back="/loyalty" title={`${l.retailerCode} · ${l.retailerName}`}
            subtitle={l.programs ? l.programs.map(p => `${p.code} · ${p.name}`).join('; ') || 'Chưa có chương trình còn hiệu lực áp dụng.' : `${l.programCode} · ${l.programName}`} />
          <Callout tone={l.available < 0 ? 'warn' : 'info'}>
            {l.available < 0 ? 'Số dư điểm đang âm sau điều chỉnh; nhà bán lẻ chưa thể gửi yêu cầu đổi quà mới. ' : ''}
            Điểm mua hàng được xét khi đơn hàng hoàn tất. Điểm chờ cộng và điểm đang giữ đổi quà chưa thể dùng để đổi thêm quà.
          </Callout>
          <Card>
            <Fields cols={3} items={[
              { label: 'Số dư điểm', value: formatNumber(l.balance) },
              { label: 'Đang giữ (chờ hoàn tất đổi quà)', value: formatNumber(l.held) },
              { label: 'Khả dụng', value: formatNumber(l.available) },
              { label: 'Điểm chờ cộng', value: formatNumber(l.pendingOrders) },
              { label: 'Hạn điểm', value: l.pointsExpireOn ? formatInstantDate(l.pointsExpireOn) : 'Không hết hạn' },
            ]} />
          </Card>
          <Card title="Sổ điểm" flush>
            <SimpleTable
              rows={l.ledger}
              empty="Chưa phát sinh điểm."
              columns={[
                { header: 'Ngày', width: '110px', cell: (e) => formatInstantDate(e.date) },
                { header: 'Nội dung', cell: (e) => e.description },
                { header: 'Loại', width: '160px', cell: (e) => <Chip tone="info">{kindLabel[e.kind] ?? e.kind}</Chip> },
                { header: 'Điểm', width: '90px', align: 'right', cell: (e) => (e.points == null ? '—' : (e.points > 0 ? '+' : '') + formatNumber(e.points)) },
                { header: 'Khả dụng sau giao dịch', align: 'right', cell: e => e.balanceAfter == null ? '—' : formatNumber(e.balanceAfter) },
                { header: 'Nguồn', cell: e => <>
                  {e.salesOrderId && <Link className="btn btn-sm" to={`/orders/${encodeURIComponent(e.salesOrderId)}`}>{e.orderCode || 'Xem đơn nguồn'}</Link>}
                  {e.redemptionId && <Link className="btn btn-sm" to={`/redeem/${encodeURIComponent(e.redemptionId)}`}>Xem yêu cầu đổi quà</Link>}
                  {!e.salesOrderId && !e.redemptionId && '—'}
                </> },
              ]}
            />
          </Card>
          <Card title="Yêu cầu đổi quà" flush>
            <SimpleTable
              rows={l.redemptions}
              empty="Chưa có yêu cầu đổi quà."
              columns={[
                { header: 'Mã', cell: (x) => <Link to={`/redeem/${encodeURIComponent(x.code)}`}>{x.code}</Link> },
                { header: 'Quà', cell: (x) => `${x.giftCode} · ${x.giftName}` },
                { header: 'Điểm', align: 'right', cell: (x) => formatNumber(x.points) },
                { header: 'Ngày yêu cầu', cell: (x) => formatInstantDate(x.requestedAt) },
                { header: 'Trạng thái', cell: (x) => <StatusChip domain="gift" value={x.status} /> },
              ]}
            />
          </Card>
        </>
      )}
    </QueryState>
  );
}
