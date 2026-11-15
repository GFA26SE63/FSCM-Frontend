import type { CurrentUser } from './authApi';
import type { PortalRole } from './roles';
import { ApiError } from '../api/errors';

export const ACTION_ROLES = {
  'users.manage': ['Admin'],

  'regions.manage': ['Admin'],
  'salesGroups.manage': ['Admin'],
  'territory.assign': ['Admin', 'SalesManager'],

  'products.manage': ['Admin'],
  'loyalty.manage': ['Admin'],
  'categories.manage': ['Admin'],
  'warehouses.manage': ['Admin'],

  // SO chỉ được rút trước khi allocation hoàn tất.
  // Trạng thái cụ thể được kiểm tra tại orderAccess.ts
  // và được backend kiểm tra lại.
  'orders.withdraw': ['Admin', 'Operator'],

  // Allocation real-time là màn theo dõi.
  'allocation.view': ['Admin', 'Operator'],

  // Portal chỉ có Operator trong các role được collect.
  'payments.collect': ['Operator'],
  'payments.adjust': ['Admin', 'Operator'],
  // F101: create refund records and submit transfer proof; only Admin verifies it.
  'refunds.manage': ['Admin', 'Operator'],
  'refunds.verify': ['Admin'],

  'receipts.create': ['Admin', 'WarehouseKeeper'],
  'receipts.approve': ['Admin', 'WarehouseKeeper'],

  'picking.scan': ['WarehouseKeeper'],
  'picking.complete': ['WarehouseKeeper'],
  'picking.viewPrice': ['Admin', 'Operator'],

  'fleet.manage': ['Admin', 'Operator'],
  'redeem.manage': ['Admin', 'Operator'],

  // Operator may request more evidence; only Admin approves/rejects (F62).
  'complaints.resolve': ['Admin', 'Operator'],
  'complaints.decide': ['Admin'],

  'inventory.lock': [
    'Admin',
    'WarehouseKeeper',
    'Operator',
  ],
  'inventory.unlock': [
    'Admin',
  ],
  'inventory.viewHistory': [
    'Admin',
    'WarehouseKeeper',
    'Operator',
  ],

  'retailers.review': ['Admin', 'Operator'],
  'retailers.status': ['Admin'],

  // Endpoint /mlor-configurations hỗ trợ quản trị và vận hành.
  'mlor.read': ['Admin', 'Operator'],
  'mlor.manage': ['Admin', 'Operator'],

  // Chỉnh sửa hồ sơ retailer theo khai báo/xét duyệt.
  'retailers.create': ['Admin'],
  'retailers.edit': ['Admin', 'Operator'],

  // Quản lý và in tem QR lô hàng kho.
  'qr.view': ['Admin', 'WarehouseKeeper', 'Operator'],
  'qr.generate': ['Admin', 'WarehouseKeeper', 'Operator'],
  'qr.print': ['Admin', 'WarehouseKeeper', 'Operator'],

  // InternalTransfersController hiện có [NonController].
  'transfers.manage': [],
  'transfers.receive': [],
} as const satisfies Record<
  string,
  readonly PortalRole[]
>;

export type Permission =
  keyof typeof ACTION_ROLES;

export function can(
  user: CurrentUser | null,
  permission: Permission,
): boolean {
  if (!user) return false;

  // Admin is the system-wide operator. Individual permission matrices still
  // document delegated roles, but must never hide an Admin capability.
  if (user.role === 'Admin') return true;

  const roles:
    | readonly PortalRole[]
    | undefined = ACTION_ROLES[permission];

  return roles?.includes(user.role) ?? false;
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
