import type { PortalRole } from '@/shared/auth/roles';
import type { DashboardCard } from './types';

export function defaultDashboardDates(now = new Date()) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return { fromDate: `${today.slice(0, 7)}-01`, toDate: today };
}
export const DASHBOARD_TITLES: Record<PortalRole, string> = {
  Admin: 'Tổng quan toàn hệ thống', Operator: 'Điều hành & báo cáo',
  WarehouseKeeper: 'Tổng quan kho được phân công', SalesManager: 'Tổng quan kinh doanh khu vực',
};
export function dashboardTabs(role: PortalRole) {
  if (role === 'WarehouseKeeper') return [{ key: 'overview', label: 'Công việc kho' }, { key: 'inventory', label: 'Tồn kho & hạn sử dụng' }];
  if (role === 'SalesManager') return [{ key: 'overview', label: 'Tổng quan nhóm' }, { key: 'sales', label: 'Thành viên & sản phẩm' }, { key: 'customers', label: 'Điểm bán & công nợ' }];
  const tabs = [{ key: 'overview', label: 'Tổng quan' }, { key: 'operations', label: 'Việc cần xử lý' },
    { key: 'inventory', label: 'Tồn kho' }, { key: 'finance', label: 'Tiền & công nợ' },
    { key: 'quality', label: 'Chất lượng dịch vụ' }, { key: 'sales', label: 'Kinh doanh' }];
  // Background-job health is technical, so only Admin gets the tab.
  return role === 'Admin' ? [...tabs, { key: 'health', label: 'Tác vụ hệ thống' }] : tabs;
}

const CARD_KEYS = {
  ops: ['allocationIssues', 'quotesPending', 'prepaid', 'shipmentsReady', 'shipmentExceptions', 'shipmentsLate', 'complaintsOpen', 'redemptionOpen', 'pendingDeclarations'],
  stock: ['receiptPending', 'pickingPending', 'pickingActive', 'shipmentsReady', 'nearExpiry', 'expired'],
  finance: ['revenue', 'completed', 'collected', 'outstanding', 'overdue', 'prepaid'],
  quality: ['fillRate', 'onTimeRate', 'allocationSuccess', 'quoteConversion', 'complaintRate'],
  customers: ['cycleOverdue', 'newRetailers', 'pendingDeclarations', 'quoteConversion'],
};

export function visibleCards(cards: DashboardCard[], role: PortalRole, tab: string) {
  const keys = tab === 'inventory' || role === 'WarehouseKeeper' ? CARD_KEYS.stock
    : tab === 'operations' || role === 'Operator' && tab === 'overview' ? CARD_KEYS.ops
    : tab === 'quality' ? CARD_KEYS.quality
    : tab === 'customers' ? CARD_KEYS.customers
    : CARD_KEYS.finance;
  return keys.flatMap(key => cards.filter(card => card.key === key));
}

/** "▲ 12.5% so với kỳ trước" for tiles that carry a comparable previous-period value. */
export function periodChange(value: number, previous?: number | null) {
  if (previous == null) return null;
  if (previous === 0) return value === 0 ? 'Không đổi so với kỳ trước' : 'Kỳ trước chưa có số liệu';
  const pct = (value - previous) / Math.abs(previous) * 100;
  return `${pct > 0 ? '▲' : pct < 0 ? '▼' : '='} ${Math.abs(pct).toFixed(1)}% so với kỳ trước`;
}
