import type { PortalPage, PortalRole } from '../../shared/domain/portal'

export interface NavigationItem {
  page: PortalPage
  label: string
  roles: PortalRole[]
  group: string
}

export const navigationItems: NavigationItem[] = [
  { page: 'dashboard', label: 'Dashboard', roles: ['Admin'], group: 'Tổng quan' },
  { page: 'orders', label: 'Đơn hàng', roles: ['Admin', 'Operator'], group: 'Vận hành' },
  { page: 'debts', label: 'Công nợ', roles: ['Admin', 'Operator'], group: 'Vận hành' },
  { page: 'picking', label: 'Picking list', roles: ['Admin', 'Warehouse Keeper'], group: 'Kho & tồn' },
  { page: 'receipts', label: 'Nhập kho', roles: ['Admin', 'Warehouse Keeper'], group: 'Kho & tồn' },
  { page: 'transfers', label: 'Điều chuyển kho', roles: ['Admin', 'Warehouse Keeper'], group: 'Kho & tồn' },
  { page: 'batches', label: 'Quản lý batch', roles: ['Admin', 'Operator', 'Warehouse Keeper'], group: 'Kho & tồn' },
  { page: 'batchPromotions', label: 'Giảm giá theo HSD', roles: ['Admin'], group: 'Thương mại' },
  { page: 'disposals', label: 'Hủy hàng hết hạn', roles: ['Admin', 'Warehouse Keeper'], group: 'Kho & tồn' },
  { page: 'promotions', label: 'Khuyến mãi', roles: ['Admin'], group: 'Thương mại' },
  { page: 'retailers', label: 'Retailer', roles: ['Admin', 'Operator'], group: 'Thương mại' },
  { page: 'loyalty', label: 'Loyalty', roles: ['Admin'], group: 'Thương mại' },
  { page: 'regions', label: 'Khu vực & nhóm Sales', roles: ['Admin', 'Sales Manager'], group: 'Tổ chức' },
  { page: 'categories', label: 'Danh mục sản phẩm', roles: ['Admin'], group: 'Danh mục' },
  { page: 'products', label: 'Sản phẩm (SKU)', roles: ['Admin'], group: 'Danh mục' },
  { page: 'warehouses', label: 'Kho', roles: ['Admin'], group: 'Danh mục' },
  { page: 'users', label: 'Người dùng', roles: ['Admin'], group: 'Quản trị' },
  { page: 'salesKpi', label: 'KPI Sales', roles: ['Admin', 'Sales Manager'], group: 'Báo cáo' },
  { page: 'complaints', label: 'Khiếu nại', roles: ['Admin', 'Operator'], group: 'Vận hành' },
  { page: 'configuration', label: 'Cấu hình hệ thống', roles: ['Admin'], group: 'Quản trị' },
]

export function navigationForRole(role: PortalRole) {
  return navigationItems.filter((item) => item.roles.includes(role))
}
