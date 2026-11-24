import { useNavigate } from '@/shared/router/compat';
import { Button, Card, Chip, SimpleTable } from '@/shared/ui';
import { formatNumber } from '@/shared/lib';
import { formatDate } from '@/shared/lib/dates';
import type { DashboardResponse } from '../types';

export const EXPIRY_PAGE_SIZE = 10;

/** Number of rows to show next: one more page, never past what was loaded. */
export function nextVisible(current: number, loaded: number, page = EXPIRY_PAGE_SIZE) {
  return Math.min(current + page, loaded);
}

/**
 * Near-expiry and expired batches, soonest expiry first, with the common table pager.
 * A capped dashboard result still points to the full batch list.
 */
export function ExpiryRiskCard({ rows, total }: { rows: DashboardResponse['expiryRisks']; total?: number }) {
  const navigate = useNavigate();
  const all = total ?? rows.length;
  const capped = all > rows.length;
  return (
    <Card title={`Lô hàng cần chú ý · ${formatNumber(all)} lô hàng cận hạn / hết hạn, ưu tiên theo hạn sử dụng`}>
      <SimpleTable paginate rows={rows} empty="Không có lô hàng cận hạn/hết hạn còn tồn." columns={[
        { header: 'Lô hàng / kho', cell: b => <>{b.batchCode}<br />{b.warehouseCode}</> },
        { header: 'SKU', cell: b => b.sku }, { header: 'Hết hạn', cell: b => formatDate(b.expirationDate) },
        { header: 'Tồn vật lý', align: 'right', cell: b => formatNumber(b.onHand) },
        { header: 'Khả dụng', align: 'right', cell: b => formatNumber(b.available) },
        { header: 'Cảnh báo', cell: b => <Chip tone={b.status === 'Expired' ? 'danger' : 'warn'}>{b.status === 'Expired' ? 'Hết hạn' : 'Cận hạn'}</Chip> },
        { header: '', cell: b => <Button size="sm" onClick={() => navigate(`/batches/${encodeURIComponent(b.batchCode)}`)}>Xem lô hàng</Button> },
      ]} />
      {capped && (
        <div className="dashboard-more">
          <span className="muted small">
            Đã tải {formatNumber(rows.length)} / {formatNumber(all)} lô hàng vào Tổng quan · xem toàn bộ trong Quản lý lô hàng
          </span>
          {capped && (
            <Button size="sm" onClick={() => navigate('/batches')}>Mở Quản lý lô hàng</Button>
          )}
        </div>
      )}
    </Card>
  );
}
