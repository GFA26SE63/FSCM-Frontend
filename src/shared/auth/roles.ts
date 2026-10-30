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

export const isPortalRole = (r: string): r is PortalRole => (PORTAL_ROLES as string[]).includes(r);
