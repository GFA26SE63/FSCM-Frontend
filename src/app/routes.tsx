import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { PortalRole } from '@/shared/auth/roles';
import type { MenuBadges } from '@/features/notifications';

/** lazy() for a named export of a feature barrel (each feature becomes one async chunk). */
function page<M extends Record<string, unknown>>(loader: () => Promise<M>, name: keyof M) {
  return lazy(() => loader().then((m) => ({ default: m[name] as ComponentType })));
}

export interface AppRoute {
  /** Menu key + first URL segment (same keys as the prototype). */
  key: string;
  label: string;
  roles: PortalRole[];
  badge?: keyof MenuBadges;
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
const picking = () => import('@/features/picking');
const runpicking = () => import('@/features/runpicking');
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
const kpi = () => import('@/features/kpi');
const complaints = () => import('@/features/complaints');
const refunds = () => import('@/features/refunds');
const config = () => import('@/features/config');
const dashboard = () => import('@/features/dashboard');

/** Single source for routing + sidebar menu (order = menu order, roles = who sees / may open it). */
export const APP_ROUTES: AppRoute[] = [
  { key: 'dashboard', label: 'Dashboard', roles: [A], list: page(dashboard, 'DashboardPage') },
  { key: 'orders', label: 'Đơn hàng', roles: [A, OP], badge: 'orders', list: page(orders, 'OrdersPage'), sub: [{ path: ':code', element: page(orders, 'OrderDetailPage') }] },
  { key: 'allocation', label: 'Duyệt phương án đợt', roles: [A], list: page(allocation, 'AllocationRunPage') },
  { key: 'debts', label: 'Công nợ', roles: [A, OP], badge: 'debts', list: page(debts, 'DebtsPage') },
  { key: 'runpicking', label: 'Phiếu soạn theo đợt', roles: [A, OP, WK], list: page(runpicking, 'RunPickingPage') },
  { key: 'picking', label: 'Picking list', roles: [A, WK], list: page(picking, 'PickingListPage'), sub: [{ path: ':code', element: page(picking, 'PickingDetailPage') }] },
  {
    key: 'receipts', label: 'Nhập kho', roles: [A, WK], list: page(receipts, 'ReceiptsPage'),
    sub: [{ path: 'new', element: page(receipts, 'ReceiptFormPage') }, { path: ':code', element: page(receipts, 'ReceiptDetailPage') }],
  },
  { key: 'whtransfer', label: 'Điều chuyển kho', roles: [A, WK], list: page(whtransfer, 'TransfersPage'), sub: [{ path: ':code', element: page(whtransfer, 'TransferDetailPage') }] },
  { key: 'rotation', label: 'Luân chuyển cận hạn', roles: [A], list: page(rotation, 'RotationPage'), sub: [{ path: ':id', element: page(rotation, 'RotationDetailPage') }] },
  { key: 'fleet', label: 'Xe & người giao', roles: [A, OP], list: page(fleet, 'FleetPage'), sub: [{ path: ':id', element: page(fleet, 'FleetDetailPage') }] },
  { key: 'batches', label: 'Quản lý batch', roles: [A, WK, OP], list: page(batches, 'BatchesPage'), sub: [{ path: ':code', element: page(batches, 'BatchDetailPage') }] },
  { key: 'batchpromo', label: 'Giảm giá theo HSD', roles: [A], list: page(batchpromo, 'BatchPromoPage'), sub: [{ path: 'scan', element: page(batchpromo, 'BatchPromoScanPage') }] },
  {
    key: 'disposal', label: 'Hủy hàng hết hạn', roles: [A, WK], badge: 'disposal', list: page(disposal, 'DisposalPage'),
    sub: [{ path: 'new', element: page(disposal, 'DisposalFormPage') }, { path: ':code', element: page(disposal, 'DisposalDetailPage') }],
  },
  {
    key: 'promos', label: 'Khuyến mãi', roles: [A], list: page(promos, 'PromosPage'),
    sub: [{ path: 'new', element: page(promos, 'PromoFormPage') }, { path: ':id', element: page(promos, 'PromoDetailPage') }],
  },
  { key: 'retailers', label: 'Retailer', roles: [A, OP], badge: 'retailers', list: page(retailers, 'RetailersPage'), sub: [{ path: ':code', element: page(retailers, 'RetailerDetailPage') }] },
  { key: 'loyalty', label: 'Loyalty – điểm', roles: [A], list: page(loyalty, 'LoyaltyPage'), sub: [{ path: ':code', element: page(loyalty, 'LoyaltyDetailPage') }] },
  { key: 'gifts', label: 'Quà đổi điểm', roles: [A], list: page(gifts, 'GiftsPage') },
  { key: 'redeem', label: 'Yêu cầu đổi quà', roles: [A, OP], badge: 'redeem', list: page(redeem, 'RedeemPage'), sub: [{ path: ':code', element: page(redeem, 'RedeemDetailPage') }] },
  { key: 'regions', label: 'Khu vực & nhóm Sales', roles: [A, SM], list: page(regions, 'RegionsPage'), sub: [{ path: ':code', element: page(regions, 'GroupDetailPage') }] },
  { key: 'cats', label: 'Danh mục sản phẩm', roles: [A], list: page(categories, 'CategoriesPage'), sub: [{ path: ':code', element: page(categories, 'CategoryDetailPage') }] },
  { key: 'skus', label: 'Sản phẩm (SKU)', roles: [A], list: page(products, 'ProductsPage'), sub: [{ path: ':sku', element: page(products, 'ProductDetailPage') }] },
  { key: 'whs', label: 'Kho', roles: [A], list: page(warehouses, 'WarehousesPage'), sub: [{ path: ':code', element: page(warehouses, 'WarehouseDetailPage') }] },
  { key: 'users', label: 'Người dùng', roles: [A], list: page(users, 'UsersPage'), sub: [{ path: ':id', element: page(users, 'UserDetailPage') }] },
  { key: 'kpi', label: 'KPI Sales', roles: [A, SM], list: page(kpi, 'KpiPage'), sub: [{ path: ':name', element: page(kpi, 'KpiDetailPage') }] },
  { key: 'complaints', label: 'Khiếu nại', roles: [A, OP], badge: 'complaints', list: page(complaints, 'ComplaintsPage'), sub: [{ path: ':code', element: page(complaints, 'ComplaintDetailPage') }] },
  { key: 'refunds', label: 'Hoàn tiền', roles: [A, OP], list: page(refunds, 'RefundsPage') },
  { key: 'config', label: 'Cấu hình hệ thống', roles: [A], list: page(config, 'ConfigPage') },
];

/** First screen after login (prototype: Admin/Operator → orders, Warehouse Keeper → picking, Sales Manager → regions). */
export const HOME_BY_ROLE: Record<PortalRole, string> = { Admin: '/orders', Operator: '/orders', WarehouseKeeper: '/picking', SalesManager: '/regions' };
