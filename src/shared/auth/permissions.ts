import type { CurrentUser } from './authApi';
import { ApiError } from '../api/errors';

/** Screen grants are the server contract; an empty grant list grants nothing. */
export const ACTION_SCREENS = {
  'users.manage': 'users',
  'users.create': 'users',
  'users.edit': 'users',
  'users.assignRole': 'users',
  'users.status': 'users',
  'regions.manage': 'regions',
  'salesGroups.manage': 'regions',
  'territory.assign': 'regions',
  'products.manage': 'skus',
  'loyalty.manage': 'loyalty',
  'categories.manage': 'cats',
  'warehouses.manage': 'whs',
  'orders.withdraw': 'orders',
  'allocation.view': 'allocation',
  'payments.collect': 'debts',
  'payments.adjust': 'debts',
  'refunds.manage': 'refunds',
  'refunds.verify': 'refunds',
  'receipts.create': 'warehouse-inbound',
  'receipts.approve': 'warehouse-inbound',
  'picking.scan': 'warehouse-outbound',
  'picking.complete': 'warehouse-outbound',
  'picking.viewPrice': 'orders',
  'fleet.manage': 'fleet',
  'redeem.manage': 'redeem',
  'complaints.resolve': 'complaints',
  'complaints.decide': 'complaints',
  'inventory.lock': 'batches',
  'inventory.unlock': 'batches',
  'inventory.viewHistory': 'batches',
  'retailers.review': 'retailers',
  'retailers.status': 'retailers',
  'mlor.read': 'catmlor',
  'mlor.manage': 'catmlor',
  'retailers.create': 'retailers',
  'retailers.edit': 'retailers',
  'qr.view': 'batches',
  'qr.generate': 'batches',
  'qr.print': 'batches',
  'transfers.manage': 'warehouse-transfers',
  'transfers.receive': 'warehouse-transfers',
} as const;

export type Permission = keyof typeof ACTION_SCREENS;

export const ACTION_OPERATIONS: Partial<Record<Permission, readonly string[]>> = {
  'users.create': ['api:Users.Create'],
  'users.edit': ['api:Users.UpdateProfile'],
  'users.assignRole': ['api:Users.UpdateRole'],
  'users.status': ['api:Users.UpdateStatus'],
  'users.manage': ['api:Users.Create', 'api:Users.UpdateRole', 'api:Users.UpdateProfile'],
  'regions.manage': ['api:Regions.Create', 'api:Regions.Update'],
  'salesGroups.manage': ['api:SalesGroups.Create', 'api:SalesGroups.Update'],
  'territory.assign': ['api:TerritoryAssignments.TransferSales', 'api:TerritoryAssignments.AssignRetailer'],
  'products.manage': ['api:Products.Create', 'api:Products.Update'],
  'loyalty.manage': ['api:Loyalty.Create', 'api:Loyalty.Update'],
  'categories.manage': ['api:Categories.Create', 'api:Categories.Update'],
  'warehouses.manage': ['api:Warehouses.Create', 'api:Warehouses.Update'],
  'orders.withdraw': ['api:Orders.Cancel'],
  'payments.collect': ['api:Payments.Collect'],
  'payments.adjust': ['api:Payments.Adjust'],
  'refunds.manage': ['api:Refunds.Create', 'api:Refunds.Evidence'],
  'refunds.verify': ['api:Refunds.Verify'],
  'receipts.create': ['api:GoodsReceipts.Create'],
  'receipts.approve': ['api:GoodsReceipts.Approve'],
  'picking.scan': ['api:PickingLists.Scan'],
  'picking.complete': ['api:PickingLists.Complete'],
  'fleet.manage': ['api:TransportDispatches.AssignTransfer'],
  'redeem.manage': ['api:LoyaltyRedemptionWorkflow.Approve', 'api:LoyaltyRedemptionWorkflow.Deliver'],
  'complaints.resolve': ['api:Complaints.RequestEvidence', 'api:Complaints.CompleteHandling'],
  'complaints.decide': ['api:Complaints.Approve', 'api:Complaints.Reject'],
  'inventory.lock': ['api:InventoryLocks.Create'],
  'inventory.unlock': ['api:InventoryLocks.Release'],
  'retailers.review': ['api:Retailers.Review'],
  'retailers.status': ['api:Retailers.UpdateStatus'],
  'mlor.manage': ['api:MlorConfigurations.Set'],
  'retailers.create': ['api:Retailers.Declare'],
  'retailers.edit': ['api:Retailers.UpdateProfile'],
  'qr.generate': ['api:QrLabels.Generate'],
  'qr.print': ['api:QrLabels.Print', 'api:QrLabels.PrintBatch'],
  'transfers.manage': ['api:InternalTransfers.Create'],
  'transfers.receive': ['api:InternalTransfers.Receive'],
};

export function can(
  user: CurrentUser | null,
  permission: Permission,
): boolean {
  if (!user) return false;

  // Admin is the system-wide operator. Individual permission matrices still
  // document delegated roles, but must never hide an Admin capability.
  if (user.role === 'Admin') return true;

  // Sessions created before the permission contract are upgraded on /auth/me.
  // An explicit empty list must never restore role defaults.
  if (user.permissions === undefined) {
    return false;
  }
  const operations = ACTION_OPERATIONS[permission];
  return operations
    ? operations.some(key => user.permissions!.includes(key))
    : user.permissions.includes(ACTION_SCREENS[permission]);
}

/** Exact API capabilities control actions; business profiles only describe data scope/layout. */
export function hasOperation(user: CurrentUser | null | undefined, operation: string): boolean {
  return !!user && (user.role === 'Admin' || user.permissions?.includes(operation) === true);
}

export function hasScreen(user: CurrentUser | null | undefined, screen: string): boolean {
  return !!user && (user.role === 'Admin' || user.permissions?.includes(screen) === true);
}

export function assertPermission(
  user: CurrentUser | null,
  permission: Permission,
): void {
  if (!user) {
    throw new ApiError(
      401,
      'Bạn cần đăng nhập để tiếp tục',
    );
  }

  if (!can(user, permission)) {
    throw new ApiError(
      403,
      'Bạn chưa được cấp quyền thực hiện thao tác này',
      'Tài khoản hiện tại chưa được cấp quyền thực hiện thao tác này.',
    );
  }
}
