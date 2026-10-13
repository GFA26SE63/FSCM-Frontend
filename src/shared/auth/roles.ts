/** Roles (SPEC §2). Portal roles can sign in to the web portal; Sales/Retailer use the mobile app. */
export type PortalRole = 'Admin' | 'Operator' | 'WarehouseKeeper' | 'SalesManager';
export type AppRole = PortalRole | 'Sales' | 'Retailer';

export const PORTAL_ROLES: PortalRole[] = ['Admin', 'Operator', 'WarehouseKeeper', 'SalesManager'];

export const roleLabel: Record<AppRole, string> = {
  Admin: 'Admin',
  Operator: 'Operator',
  WarehouseKeeper: 'Warehouse Keeper',
  SalesManager: 'Sales Manager',
  Sales: 'Sales',
  Retailer: 'Retailer',
};

/** Demo accounts used by the mock Entra login and the role switcher (names from the prototype). */
export const DEMO_ACCOUNTS: Record<PortalRole, { email: string; name: string }> = {
  Admin: { email: 'khoa.pm@fscm.local', name: 'Phạm Minh Khoa' },
  Operator: { email: 'trang.lt@fscm.local', name: 'Lý Thu Trang' },
  WarehouseKeeper: { email: 'tam.dv@fscm.local', name: 'Đỗ Văn Tâm' },
  SalesManager: { email: 'bao.hg@fscm.local', name: 'Hồ Gia Bảo' },
};

export const isPortalRole = (r: string): r is PortalRole => (PORTAL_ROLES as string[]).includes(r);
