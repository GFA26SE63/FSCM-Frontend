import { statusLabel } from '@/shared/lib/status';
import { REFUND_STATUS_LABEL, type RefundStatus } from '@/features/refunds/types';

/** The same status code can mean different things on different documents. */
export function workItemStatus(kind: string, status: string): string {
  switch (kind) {
    case 'allocation': return statusLabel('order', status);
    case 'redemption': return statusLabel('gift', status);
    case 'complaint': return statusLabel('complaint', status);
    case 'shipment': return statusLabel('shipment', status);
    case 'receipt': return statusLabel('receipt', status);
    case 'refund': return REFUND_STATUS_LABEL[status as RefundStatus] ?? status;
    case 'picking': return ({ Pending: 'Chờ soạn', InProgress: 'Đang soạn', Completed: 'Đã soạn xong', Exception: 'Cần xử lý phát sinh' } as Record<string, string>)[status] ?? status;
    case 'transfer': return status === 'Confirmed' ? 'Đã xuất · chờ nhập kho đích' : status;
    case 'disposal': return status === 'Expired' ? 'Đã quá hạn · cần tiêu hủy' : status;
    default: return status;
  }
}
