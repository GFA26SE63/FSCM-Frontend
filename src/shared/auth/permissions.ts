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

  'receipts.create': ['Admin', 'WarehouseKeeper'],
  'receipts.approve': ['Admin', 'WarehouseKeeper'],

  'disposal.create': ['Admin', 'WarehouseKeeper'],
  'disposal.approve': ['Admin'],

  'picking.scan': ['WarehouseKeeper'],
  'picking.complete': ['WarehouseKeeper'],
  'picking.viewPrice': ['Admin', 'Operator'],

  'fleet.manage': ['Admin', 'Operator'],
  'redeem.manage': ['Admin', 'Operator'],

  'complaints.resolve': ['Admin', 'Operator'],

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

  // Endpoint /mlor-configurations hiện yêu cầu Admin.
  'mlor.read': ['Admin'],
  'mlor.manage': ['Admin'],

  // Portal chưa có API tạo/sửa retailer tổng quát.
  // Sales declaration được triển khai trên Mobile.
  'retailers.create': [],
  'retailers.edit': [],

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
      'Không đủ quyền thực hiện thao tác',
      'Tài khoản hiện tại không được phép thực hiện thao tác này.',
    );
  }
}