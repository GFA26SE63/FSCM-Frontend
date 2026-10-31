import type { CurrentUser } from "./authApi";
import type { PortalRole } from "./roles";
import { ApiError } from "../api/errors";

export const ACTION_ROLES = {
  "users.manage": ["Admin"],

  "regions.manage": ["Admin"],
  "salesGroups.manage": ["Admin"],
  "territory.assign": ["Admin", "SalesManager"],

  "products.manage": ["Admin"],
  "loyalty.manage": ["Admin"],
  "categories.manage": ["Admin"],
  "warehouses.manage": ["Admin"],

  "orders.approve": ["Admin", "Operator"],
  "orders.reject": ["Admin", "Operator"],
  "orders.cancel": ["Admin", "Operator"],
  "orders.dispatch": ["Admin", "Operator"],

  // Endpoint collect của BE không cho Admin.
  "payments.collect": ["Operator"],
  "payments.adjust": ["Admin", "Operator"],

  "receipts.create": ["Admin", "WarehouseKeeper"],
  "receipts.approve": ["Admin", "WarehouseKeeper"],

  // Admin được xem picking nhưng không được quét/hoàn tất.
  "picking.scan": ["WarehouseKeeper"],
  "picking.complete": ["WarehouseKeeper"],
  "picking.viewPrice": ["Admin", "Operator"],

  "fleet.manage": ["Admin", "Operator"],
  "redeem.manage": ["Admin", "Operator"],
  "complaints.resolve": ["Admin", "Operator"],

  "inventory.lock": ["Admin", "WarehouseKeeper", "Operator"],
  "inventory.viewHistory": ["Admin", "WarehouseKeeper", "Operator"],

  "retailers.review": ["Admin"],
  "retailers.status": ["Admin"],

  // MlorConfigurationsController hiện yêu cầu Admin.
  "mlor.read": ["Admin"],
  "mlor.manage": ["Admin"],

  "allocation.approve": ["Admin"],
  "allocation.recalculate": ["Admin"],
  "allocation.issuePicking": ["Admin", "Operator"],

  // UI tạo/sửa retailer tổng quát hiện dùng API prototype.
  // BE hiện chỉ có khai báo/sửa khai báo bởi Sales,
  // review/status bởi Admin.
  "retailers.create": [],
  "retailers.edit": [],

  // Controller điều chuyển hiện đã bị tắt.
  "transfers.manage": [],
  "transfers.receive": [],
} as const satisfies Record<string, readonly PortalRole[]>;

export type Permission = keyof typeof ACTION_ROLES;

export function can(user: CurrentUser | null, permission: Permission): boolean {
  if (!user) return false;

  const roles: readonly PortalRole[] = ACTION_ROLES[permission];

  return roles.includes(user.role);
}

export function assertPermission(
  user: CurrentUser | null,
  permission: Permission,
): void {
  if (!user) {
    throw new ApiError(401, "Bạn cần đăng nhập để tiếp tục");
  }

  if (!can(user, permission)) {
    throw new ApiError(
      403,
      "Không đủ quyền thực hiện thao tác",
      "Tài khoản hiện tại không được phép thực hiện thao tác này.",
    );
  }
}
