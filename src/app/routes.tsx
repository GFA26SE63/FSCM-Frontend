import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { PortalRole } from '@/shared/auth/roles';

type MenuBadgeKey = 'orders' | 'debts' | 'retailers' | 'redeem' | 'complaints' | 'disposal';

/** lazy() for a named export of a feature barrel (each feature becomes one async chunk). */
function page<M extends Record<string, unknown>>(loader: () => Promise<M>, name: keyof M) {
  return lazy(() => loader().then((m) => ({ default: m[name] as ComponentType })));
}

export interface AppRoute {
  /** Menu key + first URL segment (same keys as the prototype). */
  key: string;
  label: string;
  roles: PortalRole[];
  /** Reserved for a future dedicated menu-summary endpoint. */
  badge?: MenuBadgeKey;
  /** Personal inboxes are available to every Portal role, independent of feature grants. */
  availableToAllPortalUsers?: boolean;
  /** Hidden from sidebar menu (e.g. preserved routes not in prototype prod sidebar). */
  hidden?: boolean;
  /** Separate sidebar entries sharing one page, selected by query string. */
  menuLinks?: { key: string; label: string; to: string }[];
  list: LazyExoticComponent<ComponentType>;
  /** Extra sub-routes relative to /<key> (detail, create, scan …). */
  sub?: { path: string; element: LazyExoticComponent<ComponentType> }[];
}

const A: PortalRole = 'Admin';
const OP: PortalRole = 'Operator';
const WK: PortalRole = 'WarehouseKeeper';
const SM: PortalRole = 'SalesManager';

const orders = () => import('@/features/orders');
const allocation = () => import('@/features/allocation');
const debts = () => import('@/features/debts');
const refunds = () => import('@/features/refunds');
const runpicking = () => import('@/features/runpicking');
const shipments = () => import('@/features/shipments');
const receipts = () => import('@/features/receipts');
const whtransfer = () => import('@/features/whtransfer');
const rotation = () => import('@/features/rotation');
const fleet = () => import('@/features/fleet');
const batches = () => import('@/features/batches');
const batchpromo = () => import('@/features/batchpromo');
const disposal = () => import('@/features/disposal');
const promos = () => import('@/features/promos');
const retailers = () => import('@/features/retailers');
const loyalty = () => import('@/features/loyalty');
const gifts = () => import('@/features/gifts');
const redeem = () => import('@/features/redeem');
const regions = () => import('@/features/regions');
const categories = () => import('@/features/categories');
const products = () => import('@/features/products');
const warehouses = () => import('@/features/warehouses');
const users = () => import('@/features/users');
const roles = () => import('@/features/roles');
const kpi = () => import('@/features/kpi');
const complaints = () => import('@/features/complaints');
const config = () => import('@/features/config');
const dashboard = () => import('@/features/dashboard');
const reports = () => import('@/features/reports');
const warehouseReport = () => import('@/features/warehouse-report');
const notifications = () => import('@/features/notifications');

/** Single source for routing + sidebar menu (matching prototype prod menuAll order and roles). */
export const APP_ROUTES: AppRoute[] = [
  { key: 'inventory', label: 'Tồn kho · QR nhà máy', roles: [A, WK, OP], hidden: true, list: page(() => import('@/features/inventory'), 'InventoryPage') },
  { key: 'factory-traceability', label: 'Nhà máy · truy xuất nguồn gốc', roles: [A], hidden: true, list: page(() => import('@/features/factory-traceability'), 'FactoryTraceabilityPage') },
  { key: 'warehouse-inbound', label: 'Nhập kho', roles: [A, WK], list: page(() => import('@/features/warehouse-work'), 'WarehouseInboundPage'), sub: [{ path: 'new', element: page(() => import('@/features/warehouse-work'), 'WarehouseInboundPage') }, { path: ':documentId', element: page(() => import('@/features/warehouse-work'), 'WarehouseInboundPage') }] },
  { key: 'warehouse-receipts', label: 'Phiếu nhập kho (PNK)', roles: [A, WK], hidden: true, list: page(() => import('@/features/warehouse-work'), 'WarehouseReceiptsPage'), sub: [{ path: 'new', element: page(() => import('@/features/warehouse-work'), 'WarehouseReceiptsPage') }, { path: ':documentId', element: page(() => import('@/features/warehouse-work'), 'WarehouseReceiptsPage') }] },
  { key: 'warehouse-outbound', label: 'Xuất kho', roles: [A, WK], list: page(() => import('@/features/warehouse-work'), 'WarehouseOutboundPage'), sub: [{ path: 'new', element: page(() => import('@/features/warehouse-work'), 'WarehouseOutboundPage') }, { path: ':documentId', element: page(() => import('@/features/warehouse-work'), 'WarehouseOutboundPage') }] },
  { key: 'warehouse-issues', label: 'Phiếu xuất kho (PXK)', roles: [A, WK], hidden: true, list: page(() => import('@/features/warehouse-work'), 'WarehouseIssuesPage'), sub: [{ path: 'new', element: page(() => import('@/features/warehouse-work'), 'WarehouseIssuesPage') }, { path: ':documentId', element: page(() => import('@/features/warehouse-work'), 'WarehouseIssuesPage') }] },
  { key: 'warehouse-transfers', label: 'Luân chuyển kho', roles: [A, WK], list: page(() => import('@/features/warehouse-work'), 'WarehouseTransferPage'), sub: [{ path: 'new', element: page(() => import('@/features/warehouse-work'), 'WarehouseTransferPage') }, { path: ':documentId', element: page(() => import('@/features/warehouse-work'), 'WarehouseTransferPage') }] },
  { key: 'warehouse-trace', label: 'Tra cứu thùng', roles: [A, WK], list: page(() => import('@/features/warehouse-work'), 'WarehouseTracePage') },
  { key: 'warehouse-work', label: 'Chứng từ kho', roles: [A, WK], hidden: true, list: page(() => import('@/features/warehouse-work'), 'WarehouseWorkPage') },
  { key: 'dashboard', label: 'Tổng quan & báo cáo', roles: [A, OP, WK, SM], list: page(dashboard, 'DashboardPage') },
  { key: 'notifications', label: 'Thông báo', roles: [A, OP, WK, SM], availableToAllPortalUsers: true, list: page(notifications, 'NotificationsPage') },
  { key: 'reports', label: 'Báo cáo đổi quà & chương trình', roles: [A, OP], list: page(reports, 'OperationsReportsPage'), menuLinks: [
    { key: 'report-redemptions', label: 'Báo cáo đổi quà', to: '/reports?kind=redemptions' },
    { key: 'report-loyalty', label: 'Báo cáo tích điểm', to: '/reports?kind=loyalty' },
    { key: 'report-promotions', label: 'Báo cáo khuyến mãi', to: '/reports?kind=promotions' },
  ] },
  { key: 'warehouse-report', label: 'Báo cáo kho vận', roles: [A, OP], list: page(warehouseReport, 'WarehouseReportPage') },
  { key: 'orders', label: 'Đơn hàng', roles: [A, OP], badge: 'orders', list: page(orders, 'OrdersPage'), sub: [{ path: ':orderId', element: page(orders, 'OrderDetailPage') }] },
  { key: 'allocation', label: 'Phân bổ theo thời gian thực', roles: [A, OP], list: page(allocation, 'AllocationRunPage') },
  { key: 'debts', label: 'Công nợ', roles: [A, OP], badge: 'debts', list: page(debts, 'DebtsPage') },
  { key: 'refunds', label: 'Hoàn tiền', roles: [A, OP], list: page(refunds, 'RefundsPage'), sub: [{ path: ':id', element: page(refunds, 'RefundDetailPage') }] },
  { key: 'runpicking', label: 'Phiếu soạn hàng', roles: [A, OP, WK], hidden: true, list: page(runpicking, 'RunPickingPage') },
  { key: 'readiness', label: 'Điều phối giao hàng', roles: [A, OP], list: page(shipments, 'OrderReadinessPage') },
  {
    key: 'receipts', label: 'Nhập kho', roles: [A, WK], hidden: true, list: page(receipts, 'ReceiptsPage'),
    sub: [{ path: 'new', element: page(() => import('@/features/warehouse-work'), 'WarehouseInboundCreatePage') }, { path: ':code', element: page(receipts, 'ReceiptDetailPage') }],
  },
  { key: 'batches', label: 'Quản lý lô hàng', roles: [A, WK, OP], list: page(batches, 'BatchesPage'), sub: [{ path: ':code', element: page(batches, 'BatchDetailPage') }] },
  { key: 'batchpromo', label: 'Giảm giá theo HSD', roles: [A], list: page(batchpromo, 'BatchPromoPage'), sub: [{ path: 'scan', element: page(batchpromo, 'BatchPromoScanPage') }] },
  {
    key: 'disposal', label: 'Hủy hàng hết hạn', roles: [A, WK], badge: 'disposal', list: page(disposal, 'DisposalPage'),
    sub: [{ path: 'new', element: page(disposal, 'DisposalFormPage') }, { path: ':code', element: page(disposal, 'DisposalDetailPage') }],
  },
  {
    key: 'promos', label: 'Khuyến mãi', roles: [A], list: page(promos, 'PromosPage'),
    sub: [{ path: 'new', element: page(promos, 'PromoFormPage') }, { path: ':id', element: page(promos, 'PromoDetailPage') }],
  },
  { key: 'retailers', label: 'Nhà bán lẻ', roles: [A, OP], badge: 'retailers', list: page(retailers, 'RetailersPage'), sub: [{ path: ':id', element: page(retailers, 'RetailerDetailPage') }] },
  { key: 'loyalty', label: 'Khách hàng thân thiết', roles: [A, OP], list: page(loyalty, 'LoyaltyPage'), sub: [
    { path: 'new', element: page(loyalty, 'ProgramCreatePage') },
    { path: ':code', element: page(loyalty, 'LoyaltyDetailPage') },
  ] },
  { key: 'redeem', label: 'Đổi quà', roles: [A, OP], badge: 'redeem', list: page(redeem, 'RedeemPage'), sub: [{ path: ':code', element: page(redeem, 'RedeemDetailPage') }] },
  { key: 'gifts', label: 'Danh mục quà đổi điểm', roles: [A], list: page(gifts, 'GiftsPage') },
  { key: 'regions', label: 'Khu vực & nhóm bán hàng', roles: [A, SM], list: page(regions, 'RegionsPage'), sub: [{ path: ':code', element: page(regions, 'GroupDetailPage') }] },
  { key: 'cats', label: 'Danh mục sản phẩm', roles: [A], list: page(categories, 'CategoriesPage'), sub: [{ path: ':code', element: page(categories, 'CategoryDetailPage') }] },
  { key: 'catmlor', label: 'Yêu cầu HSD tối thiểu theo danh mục sản phẩm', roles: [A], list: page(categories, 'CategoryMlorPage') },
  { key: 'skus', label: 'Sản phẩm (SKU)', roles: [A], list: page(products, 'ProductsPage'), sub: [
    { path: 'new', element: page(products, 'ProductCreatePage') },
    { path: ':sku/edit', element: page(products, 'ProductEditPage') },
    { path: ':sku/new-version', element: page(products, 'ProductReplacementPage') },
    { path: ':sku/clone', element: page(products, 'ProductClonePage') },
    { path: ':sku', element: page(products, 'ProductDetailPage') },
  ] },
  { key: 'whs', label: 'Kho', roles: [A], list: page(warehouses, 'WarehousesPage'), sub: [
    { path: 'new', element: page(warehouses, 'WarehouseFormPage') },
    { path: 'regions/:regionId/new', element: page(warehouses, 'WarehouseFormPage') },
    { path: 'regions/:regionId', element: page(warehouses, 'RegionWarehousesPage') },
    { path: ':code/edit', element: page(warehouses, 'WarehouseFormPage') },
    { path: ':code', element: page(warehouses, 'WarehouseDetailPage') },
  ] },
  { key: 'users', label: 'Người dùng', roles: [A], list: page(users, 'UsersPage'), sub: [{ path: ':id', element: page(users, 'UserDetailPage') }] },
  { key: 'roles', label: 'Vai trò & phân quyền', roles: [A], list: page(roles, 'RolesPage') },
  { key: 'kpi', label: 'KPI & Xếp hạng kinh doanh', roles: [A, OP, SM], list: page(kpi, 'KpiPage'), sub: [{ path: 'sales/:salesUserId/:groupId', element: page(kpi, 'KpiDetailPage') }] },
  { key: 'complaints', label: 'Yêu cầu', roles: [A, OP], badge: 'complaints', list: page(complaints, 'ComplaintsPage'), sub: [{ path: ':code', element: page(complaints, 'ComplaintDetailPage') }] },
  { key: 'config', label: 'Cấu hình hệ thống', roles: [A], list: page(config, 'ConfigPage') },

  /* Routes preserved for direct navigation / backward compatibility, not shown in prototype prod sidebar */
  { key: 'fleet', label: 'Xe & tài xế', roles: [A, OP], list: page(fleet, 'FleetPage'), sub: [{ path: ':kind/:id', element: page(fleet, 'FleetDetailPage') }] },
  { key: 'whtransfer', label: 'Điều chuyển kho', roles: [A, WK], hidden: true, list: page(whtransfer, 'TransfersPage'), sub: [{ path: ':code', element: page(whtransfer, 'TransferDetailPage') }] },
  { key: 'rotation', label: 'Luân chuyển cận hạn', roles: [A], hidden: true, list: page(rotation, 'RotationPage'), sub: [{ path: ':id', element: page(rotation, 'RotationDetailPage') }] },
];

/** Each Portal role starts on its authorized dashboard. */
export const HOME_BY_ROLE: Record<PortalRole, string> = { Admin: '/dashboard', Operator: '/dashboard', WarehouseKeeper: '/dashboard', SalesManager: '/dashboard' };
