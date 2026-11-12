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
  return [{ key: 'overview', label: 'Tổng quan' }, { key: 'operations', label: 'Việc cần xử lý' },
    { key: 'inventory', label: 'Tồn kho' }, { key: 'finance', label: 'Tiền & công nợ' },
    { key: 'sales', label: 'Kinh doanh' }, { key: 'health', label: 'Tác vụ hệ thống' }];
}
export function visibleCards(cards: DashboardCard[], role: PortalRole, tab: string) {
  const ops = ['allocationIssues', 'quotesPending', 'prepaidOrders', 'shipmentsReady', 'shipmentExceptions', 'complaintsOpen', 'returnsPending', 'redemptionPending', 'redemptionApproved', 'redemptionDelivered', 'redemptionAged'];
  const stock = ['receiptPending', 'pickingPending', 'pickingActive', 'ready', 'nearExpiry', 'expired'];
  const finance = ['revenue', 'completed', 'collected', 'outstanding', 'overdue', 'prepaid'];
  const keys = tab === 'inventory' || role === 'WarehouseKeeper' ? stock :
    tab === 'operations' || role === 'Operator' && tab === 'overview' ? ops : finance;
  return keys.flatMap(key => cards.filter(card => card.key === key));
}
