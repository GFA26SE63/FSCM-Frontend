import { useState } from 'react';
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
 * Near-expiry and expired batches, soonest expiry first, shown 10 at a time with "Hiện thêm".
 * The shown count survives the dashboard's background refresh and is clamped if the list shrinks.
 */
export function ExpiryRiskCard({ rows, total }: { rows: DashboardResponse['expiryRisks']; total?: number }) {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(EXPIRY_PAGE_SIZE);
  const shown = rows.slice(0, Math.min(visible, rows.length));
  const all = total ?? rows.length;
  const capped = all > rows.length;
  return (
    <Card title={`Batch cần chú ý · ${formatNumber(all)} batch cận hạn / hết hạn, ưu tiên theo hạn sử dụng`}>
      <SimpleTable rows={shown} empty="Không có batch cận hạn/hết hạn còn tồn." columns={[
        { header: 'Batch / kho', cell: b => <>{b.batchCode}<br />{b.warehouseCode}</> },
        { header: 'SKU', cell: b => b.sku }, { header: 'Hết hạn', cell: b => formatDate(b.expirationDate) },
        { header: 'Tồn vật lý', align: 'right', cell: b => formatNumber(b.onHand) },
        { header: 'Khả dụng', align: 'right', cell: b => formatNumber(b.available) },
        { header: 'Cảnh báo', cell: b => <Chip tone={b.status === 'Expired' ? 'danger' : 'warn'}>{b.status === 'Expired' ? 'Hết hạn' : 'Cận hạn'}</Chip> },
        { header: '', cell: b => <Button size="sm" onClick={() => navigate(`/batches/${encodeURIComponent(b.batchCode)}`)}>Xem batch</Button> },
      ]} />
      {rows.length > 0 && (
        <div className="dashboard-more">
          <span className="muted small">
            Đang hiển thị {formatNumber(shown.length)} / {formatNumber(all)} batch
            {capped && shown.length === rows.length && ` · xem toàn bộ trong Quản lý batch`}
          </span>
          {shown.length < rows.length && (
            <Button size="sm" onClick={() => setVisible(v => nextVisible(Math.min(v, rows.length), rows.length))}>
              Hiện thêm {formatNumber(Math.min(EXPIRY_PAGE_SIZE, rows.length - shown.length))} batch
            </Button>
          )}
          {capped && shown.length === rows.length && (
            <Button size="sm" onClick={() => navigate('/batches')}>Mở Quản lý batch</Button>
          )}
        </div>
      )}
    </Card>
  );
}
