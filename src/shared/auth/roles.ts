/** Roles (SPEC §2). Portal roles can sign in to the web portal; Sales/Retailer use the mobile app. */
export type PortalRole = 'Admin' | 'Operator' | 'WarehouseKeeper' | 'SalesManager' | string;
export type AppRole = PortalRole | 'Sales' | 'Retailer';

export const PORTAL_ROLES: string[] = ['Admin', 'Operator', 'WarehouseKeeper', 'SalesManager'];

export const roleLabel: Record<string, string> = {
  Admin: 'Quản trị viên',
  Operator: 'Nhân viên vận hành',
  WarehouseKeeper: 'Thủ kho',
  SalesManager: 'Quản lý bán hàng',
  Sales: 'Nhân viên bán hàng',
  Retailer: 'Nhà bán lẻ',
};

export const isPortalRole = (r: string): r is PortalRole =>
  Boolean(r) && r !== 'Retailer' && r !== 'Sales';
