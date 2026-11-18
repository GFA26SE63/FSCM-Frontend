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
  // "Tổng quan" now also holds money and receivables (the old "Tiền & công nợ" tab); "Kinh doanh"
  // holds people, products and stores. No tile, chart or table appears on two tabs.
  const tabs = [{ key: 'overview', label: 'Tổng quan' }, { key: 'operations', label: 'Việc cần xử lý' },
    { key: 'inventory', label: 'Tồn kho' }, { key: 'quality', label: 'Chất lượng dịch vụ' }, { key: 'sales', label: 'Kinh doanh' }];
  // Background-job health is technical, so only Admin gets the tab.
  return role === 'Admin' ? [...tabs, { key: 'health', label: 'Tác vụ hệ thống' }] : tabs;
}

const CARD_KEYS = {
  ops: ['allocationIssues', 'quotesPending', 'prepaid', 'shipmentsReady', 'shipmentExceptions', 'shipmentsLate', 'complaintsOpen', 'redemptionOpen', 'pendingDeclarations'],
  stock: ['receiptPending', 'pickingPending', 'pickingActive', 'shipmentsReady', 'nearExpiry', 'expired'],
  // Admin/Operator: "prepaid" belongs to "Việc cần xử lý" (a queue), so the overview leaves it out.
  overview: ['revenue', 'completed', 'collected', 'outstanding', 'overdue'],
  managerOverview: ['revenue', 'completed', 'collected', 'outstanding', 'overdue', 'prepaid'],
  quality: ['fillRate', 'onTimeRate', 'allocationSuccess', 'quoteConversion', 'complaintRate'],
  business: ['cycleOverdue', 'newRetailers'],
  customers: ['cycleOverdue', 'newRetailers', 'pendingDeclarations', 'quoteConversion'],
};

const GLOBAL_ROLES: PortalRole[] = ['Admin', 'Operator'];

export function visibleCards(cards: DashboardCard[], role: PortalRole, tab: string) {
  const global = GLOBAL_ROLES.includes(role);
  const keys = tab === 'inventory' || role === 'WarehouseKeeper' ? CARD_KEYS.stock
    : tab === 'operations' ? CARD_KEYS.ops
    : tab === 'health' ? []
    : tab === 'quality' ? CARD_KEYS.quality
    : tab === 'customers' ? CARD_KEYS.customers
    // Sales Manager keeps store tiles on "Điểm bán & công nợ", so its "Thành viên & sản phẩm" tab has none.
    : tab === 'sales' ? (global ? CARD_KEYS.business : [])
    : global ? CARD_KEYS.overview : CARD_KEYS.managerOverview;
  return keys.flatMap(key => cards.filter(card => card.key === key));
}

/** Which blocks a tab shows, so each block lives on exactly one tab. */
export function dashboardSections(role: PortalRole, tab: string) {
  const global = GLOBAL_ROLES.includes(role);
  const keeper = role === 'WarehouseKeeper';
  return {
    revenue: !keeper && tab === 'overview',
    receivables: !keeper && tab === 'overview',
    // Admin/Operator have a dedicated "Việc cần xử lý" tab; other roles see their work on the overview.
    work: global ? tab === 'operations' : tab === 'overview',
    stock: keeper || (!(role === 'SalesManager') && tab === 'inventory'),
    sales: !keeper && tab === 'sales',
    customers: role === 'SalesManager' && tab === 'customers',
    health: role === 'Admin' && tab === 'health',
  };
}

/** Rows shown by a "Hiện thêm" list: one more page of `page` rows, never past the loaded rows. */
export const SHOW_MORE_PAGE = 10;
export function nextShown(current: number, loaded: number, page = SHOW_MORE_PAGE) {
  return Math.min(current + page, loaded);
}

/** "▲ 12.5% so với kỳ trước" for tiles that carry a comparable previous-period value. */
export function periodChange(value: number, previous?: number | null) {
  if (previous == null) return null;
  if (previous === 0) return value === 0 ? 'Không đổi so với kỳ trước' : 'Kỳ trước chưa có số liệu';
  const pct = (value - previous) / Math.abs(previous) * 100;
  return `${pct > 0 ? '▲' : pct < 0 ? '▼' : '='} ${Math.abs(pct).toFixed(1)}% so với kỳ trước`;
}
