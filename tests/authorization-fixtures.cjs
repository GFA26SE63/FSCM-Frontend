// Explicit server responses for UI tests; production never infers grants from a role.
const actionDefaults = {
  'users.manage': ['Admin'],
  'users.create': ['Admin'],
  'users.edit': ['Admin'],
  'users.assignRole': ['Admin'],
  'users.status': ['Admin'],

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
};
const screens = { Operator: ['reports','readiness','loyalty','orders','retailers'], WarehouseKeeper: ['batches','warehouse-inbound','warehouse-outbound','warehouse-transfers','readiness','warehouse-trace','warehouse-factory-requests','warehouse-report','reports'], SalesManager: ['reports','regions','kpi'] };
exports.grantsFor = (role, permissions) => [...new Set([...(screens[role] ?? []), ...Object.entries(actionDefaults).filter(([, roles]) => roles.includes(role)).flatMap(([action]) => [permissions.ACTION_SCREENS[action], ...(permissions.ACTION_OPERATIONS[action] ?? [])])])];
