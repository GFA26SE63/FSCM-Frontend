import type { ExportOrder, OrderShipmentReadiness } from './types';
import { HAS_LEFT } from './types';

export type ExportOrderSort = 'newest' | 'oldest' | 'codeAsc' | 'codeDesc';
export type ShipmentSort = 'asc' | 'desc';
export const EXPORT_PAGE_SIZE = 10;

export function sortExportOrders(orders: ExportOrder[], sort: ExportOrderSort): ExportOrder[] {
  return [...orders].sort((a, b) => {
    const code = a.orderCode.localeCompare(b.orderCode, 'vi', { numeric: true });
    if (sort === 'codeAsc') return code || a.id.localeCompare(b.id);
    if (sort === 'codeDesc') return -code || a.id.localeCompare(b.id);
    const time = Date.parse(a.createdAt) - Date.parse(b.createdAt);
    return (sort === 'newest' ? -time : time) || code || a.id.localeCompare(b.id);
  });
}

export function exportStatus(readiness: OrderShipmentReadiness) {
  if (readiness.parts.length > 0 && readiness.parts.every(part => HAS_LEFT.includes(part.status))) {
    return { tone: 'deep' as const, label: 'Đã rời kho' };
  }
  if (readiness.isReady) return { tone: 'success' as const, label: 'Được xuất' };
  return { tone: readiness.hasException ? 'danger' as const : 'warn' as const,
    label: readiness.hasException ? 'Ngoại lệ' : 'Đang bị giữ' };
}
