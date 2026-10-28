import type { CurrentUser } from './authApi';
import type { PortalRole } from './roles';

export const ACTION_ROLES = {
  'users.manage': ['Admin'],

  'regions.manage': ['Admin'],
  'salesGroups.manage': ['Admin'],
  'territory.assign': ['Admin', 'SalesManager'],

  'products.manage': ['Admin'],
  'categories.manage': ['Admin'],
  'warehouses.manage': ['Admin'],

  'receipts.create': ['Admin', 'WarehouseKeeper'],
  'receipts.approve': ['Admin', 'WarehouseKeeper'],

  'picking.scan': ['WarehouseKeeper'],
  'picking.complete': ['WarehouseKeeper'],

  'transfers.manage': ['Admin', 'Operator'],
  'transfers.receive': ['WarehouseKeeper'],

  'orders.approve': ['Admin', 'Operator'],
  'orders.reject': ['Admin', 'Operator'],

  'retailers.review': ['Admin'],
  'mlor.manage': ['Admin'],

  'allocation.approve': ['Admin'],
  'picking.viewPrice': ['Admin', 'Operator'],
} as const satisfies Record<
  string,
  readonly PortalRole[]
>;

export type Permission = keyof typeof ACTION_ROLES;

export function can(
  user: CurrentUser | null,
  permission: Permission,
): boolean {
  if (!user) return false;

  const roles: readonly PortalRole[] =
    ACTION_ROLES[permission];

  return roles.includes(user.role);
}