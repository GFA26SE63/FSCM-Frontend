/** Roles (SPEC §2). Portal roles can sign in to the web portal; Sales/Retailer use the mobile app. */
export type PortalRole = 'Admin' | 'Operator' | 'WarehouseKeeper' | 'SalesManager';
export type AppRole = PortalRole | 'Sales' | 'Retailer';

export const PORTAL_ROLES: PortalRole[] = ['Admin', 'Operator', 'WarehouseKeeper', 'SalesManager'];

export const roleLabel: Record<AppRole, string> = {
  Admin: 'Quản trị viên',
  Operator: 'Nhân viên vận hành',
  WarehouseKeeper: 'Thủ kho',
  SalesManager: 'Quản lý bán hàng',
  Sales: 'Nhân viên bán hàng',
  Retailer: 'Điểm bán',
};

export const isPortalRole = (r: string): r is PortalRole => (PORTAL_ROLES as string[]).includes(r);
