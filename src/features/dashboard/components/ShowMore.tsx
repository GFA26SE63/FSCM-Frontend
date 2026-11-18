import { useState } from 'react';
import { Button } from '@/shared/ui';
import { formatNumber } from '@/shared/lib';
import { SHOW_MORE_PAGE, nextShown } from '../dashboardModel';

/** First 10 rows, then 10 more per click. The count is clamped if a refresh returns fewer rows. */
export function useShowMore<T>(rows: T[], page = SHOW_MORE_PAGE) {
  const [visible, setVisible] = useState(page);
  const count = Math.min(visible, rows.length);
  return {
    shown: rows.slice(0, count),
    more: () => setVisible(nextShown(count, rows.length, page)),
    count,
    total: rows.length,
  };
}

export function ShowMoreFooter({ count, total, unit, onMore, page = SHOW_MORE_PAGE }: {
  count: number; total: number; unit: string; onMore: () => void; page?: number;
}) {
  if (total === 0) return null;
  return (
    <div className="dashboard-more">
      <span className="muted small">Đang hiển thị {formatNumber(count)} / {formatNumber(total)} {unit}</span>
      {count < total && (
        <Button size="sm" onClick={onMore}>
          Hiện thêm {formatNumber(Math.min(page, total - count))} {unit}
        </Button>
      )}
    </div>
  );
}
