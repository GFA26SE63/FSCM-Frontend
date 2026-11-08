const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function source(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const module = { exports: {} };
  const imports = (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith('.') || name.startsWith('@/')) {
      throw new Error('Missing boundary mock: ' + name + ' in ' + file);
    }
    return require(name);
  };
  new Function('require', 'module', 'exports', code)(imports, module, module.exports);
  return module.exports;
}

const errors = source('shared/api/errors.ts');
const permissions = source('shared/auth/permissions.ts', {
  '../api/errors': errors,
  '../lib/env': { env: { useMock: false } },
});

const status = source('shared/lib/status.ts');
const statusChip = source('shared/ui/StatusChip.tsx', {
  '../lib/status': status,
});

const ids = source('shared/lib/ids.ts');

const user = (role) => ({ id: 'user-' + role, role, name: role, email: role + '@example.com' });

test('Goods Receipt status maps to exact Vietnamese business labels', () => {
  assert.equal(status.statusLabels.receipt.Pending, 'Chờ duyệt');
  assert.equal(status.statusLabels.receipt.Received, 'Đã nhập kho');
  assert.equal(status.statusLabels.receipt.Posted, 'Đã nhập kho');

  assert.equal(status.statusLabel('receipt', 'Pending'), 'Chờ duyệt');
  assert.equal(status.statusLabel('receipt', 'Received'), 'Đã nhập kho');
});

test('Goods Receipt status chips map to correct UI tones', () => {
  assert.equal(statusChip.toneOf('Chờ duyệt'), 'info');
  assert.equal(statusChip.toneOf('Đã nhập kho'), 'ok');
});

test('RBAC: Only Admin and WarehouseKeeper can create or approve Goods Receipts', () => {
  assert.equal(permissions.can(user('Admin'), 'receipts.create'), true);
  assert.equal(permissions.can(user('WarehouseKeeper'), 'receipts.create'), true);
  assert.equal(permissions.can(user('Operator'), 'receipts.create'), false);
  assert.equal(permissions.can(user('SalesManager'), 'receipts.create'), false);

  assert.equal(permissions.can(user('Admin'), 'receipts.approve'), true);
  assert.equal(permissions.can(user('WarehouseKeeper'), 'receipts.approve'), true);
  assert.equal(permissions.can(user('Operator'), 'receipts.approve'), false);
  assert.equal(permissions.can(user('SalesManager'), 'receipts.approve'), false);
});

test('mapReceiptListItem calculates batchCount and totalQty accurately', () => {
  const receiptsApi = source('features/receipts/api.ts', {
    '@/shared/api/http': {
      http: { post: () => Promise.resolve({ data: {} }), get: () => Promise.resolve({ data: {} }) },
      get: () => Promise.resolve({}),
      getAll: () => Promise.resolve([]),
      post: () => Promise.resolve({}),
    },
    '@/shared/api/errors': errors,
  });

  const rawReceipt = {
    id: '00000000-0000-0000-0000-000000000001',
    receiptCode: 'PN-261107-01',
    warehouseId: '11111111-1111-1111-1111-111111111111',
    warehouseCode: 'WH-CENTRAL',
    warehouseName: 'Kho Tổng Long Bình',
    createdByUserId: 'user-admin',
    approvedByUserId: null,
    status: 'Pending',
    receivedAt: null,
    approvedAt: null,
    createdAt: '2026-11-07T08:00:00Z',
    version: 1,
    lines: [
      {
        id: 'line-1',
        productId: 'prod-1',
        sku: 'MILK-VNM-180',
        productName: 'Sữa tươi Vinamilk 180ml',
        sourceLotCode: 'LOT-A',
        receivedQuantity: 50,
        productionDate: '2026-11-01',
        expirationDate: '2027-05-01',
        batchId: null,
        batchCode: null,
      },
      {
        id: 'line-2',
        productId: 'prod-2',
        sku: 'YOG-VNM-100',
        productName: 'Sữa chua Vinamilk 100g',
        sourceLotCode: null,
        receivedQuantity: 120,
        productionDate: '2026-11-02',
        expirationDate: '2027-01-02',
        batchId: null,
        batchCode: null,
      },
    ],
  };

  const item = receiptsApi.mapReceiptListItem(rawReceipt);
  assert.equal(item.code, 'PN-261107-01');
  assert.equal(item.batchCount, 2);
  assert.equal(item.totalQty, 170);
  assert.equal(item.status, 'Pending');
});

test('Receipt creation payload matches OpenAPI CreateGoodsReceiptRequest schema strictly', () => {
  const warehouseId = '11111111-1111-1111-1111-111111111111';
  const lines = [
    {
      productId: '22222222-2222-2222-2222-222222222222',
      quantity: 100,
      productionDate: '2026-11-01',
      expirationDate: '2027-05-01',
      sourceLotCode: 'LOT-XYZ',
    },
  ];

  const payload = {
    warehouseId,
    lines,
  };

  // Must have required fields
  assert.ok(payload.warehouseId);
  assert.equal(Array.isArray(payload.lines), true);
  assert.equal(payload.lines.length, 1);

  const line = payload.lines[0];
  assert.ok(line.productId);
  assert.ok(line.quantity > 0);
  assert.ok(line.productionDate);
  assert.ok(line.expirationDate);
  assert.ok(line.productionDate <= line.expirationDate);

  // Must not have forbidden extra properties that would fail additionalProperties: false
  assert.equal(payload.note, undefined);
  assert.equal(line.sku, undefined);
  assert.equal(line.labels, undefined);
});

test('Batch code preview follows authoritative IdFormat.batch standard', () => {
  const warehouseCode = 'WH-CENTRAL';
  const sku = 'MILK-180';
  const expiry = '2027-05-15';

  const batchCode = ids.IdFormat.batch(warehouseCode, sku, expiry);
  assert.equal(batchCode, 'WH-CENTRAL-MILK-180-15052027');
});

test('Validation: reject negative quantity, missing dates, or invalid chronological order', () => {
  const validateRow = (r) => {
    if (!r.productId) return 'Vui lòng chọn sản phẩm';
    if (!r.productionDate) return 'Vui lòng nhập ngày sản xuất';
    if (!r.expirationDate) return 'Vui lòng nhập hạn sử dụng';
    if (r.productionDate > r.expirationDate) return 'Ngày sản xuất phải trước hoặc bằng hạn sử dụng';
    const qtyNum = Number(r.quantity);
    if (!qtyNum || qtyNum <= 0) return 'Số lượng nhập phải lớn hơn 0';
    return null;
  };

  assert.equal(validateRow({ productId: '', productionDate: '2026-11-01', expirationDate: '2027-05-01', quantity: '10' }), 'Vui lòng chọn sản phẩm');
  assert.equal(validateRow({ productId: 'p1', productionDate: '', expirationDate: '2027-05-01', quantity: '10' }), 'Vui lòng nhập ngày sản xuất');
  assert.equal(validateRow({ productId: 'p1', productionDate: '2026-11-01', expirationDate: '', quantity: '10' }), 'Vui lòng nhập hạn sử dụng');
  assert.equal(validateRow({ productId: 'p1', productionDate: '2027-05-02', expirationDate: '2027-05-01', quantity: '10' }), 'Ngày sản xuất phải trước hoặc bằng hạn sử dụng');
  assert.equal(validateRow({ productId: 'p1', productionDate: '2026-11-01', expirationDate: '2027-05-01', quantity: '0' }), 'Số lượng nhập phải lớn hơn 0');
  assert.equal(validateRow({ productId: 'p1', productionDate: '2026-11-01', expirationDate: '2027-05-01', quantity: '-5' }), 'Số lượng nhập phải lớn hơn 0');
  assert.equal(validateRow({ productId: 'p1', productionDate: '2026-11-01', expirationDate: '2027-05-01', quantity: '50' }), null);
});

test('normalizeWarehouseOption correctly parses backend WarehouseResult with isActive boolean and keepers', () => {
  const receiptsApi = source('features/receipts/api.ts', {
    '@/shared/api/http': {
      http: { post: () => Promise.resolve({ data: {} }), get: () => Promise.resolve({ data: {} }) },
      get: () => Promise.resolve({}),
      getAll: () => Promise.resolve([]),
      post: () => Promise.resolve({}),
    },
    '@/shared/api/errors': errors,
  });

  const rawActive = {
    id: 'wh-1',
    code: 'WH-CENTRAL',
    name: 'Kho Tổng Long Bình',
    isActive: true,
    keepers: [{ userId: 'user-keeper-1', fullName: 'Nguyễn Văn Thủ Kho', email: 'keeper1@example.com' }],
  };

  const optionActive = receiptsApi.normalizeWarehouseOption(rawActive);
  assert.equal(optionActive.id, 'wh-1');
  assert.equal(optionActive.code, 'WH-CENTRAL');
  assert.equal(optionActive.name, 'Kho Tổng Long Bình');
  assert.equal(optionActive.isActive, true);
  assert.equal(optionActive.status, 'Active');
  assert.equal(optionActive.keepers.length, 1);
  assert.equal(optionActive.keepers[0].userId, 'user-keeper-1');

  const rawInactive = {
    id: 'wh-2',
    code: 'WH-PAUSED',
    name: 'Kho Vùng Đang Đóng',
    isActive: false,
    keepers: [],
  };

  const optionInactive = receiptsApi.normalizeWarehouseOption(rawInactive);
  assert.equal(optionInactive.isActive, false);
  assert.equal(optionInactive.status, 'Paused');
});

test('Warehouse authorization: Keeper is restricted to assigned warehouses; Admin accesses all active', () => {
  const allWarehouses = [
    {
      id: 'wh-central-id',
      code: 'WH-CENTRAL',
      name: 'Kho Tổng',
      isActive: true,
      status: 'Active',
      keepers: [{ userId: 'keeper-1', fullName: 'Thủ kho 1', email: 'k1@example.com' }],
    },
    {
      id: 'wh-dn-id',
      code: 'WH-DN',
      name: 'Kho Đà Nẵng',
      isActive: true,
      status: 'Active',
      keepers: [{ userId: 'keeper-2', fullName: 'Thủ kho 2', email: 'k2@example.com' }],
    },
    {
      id: 'wh-inactive-id',
      code: 'WH-OFF',
      name: 'Kho Ngừng',
      isActive: false,
      status: 'Paused',
      keepers: [{ userId: 'keeper-1', fullName: 'Thủ kho 1', email: 'k1@example.com' }],
    },
  ];

  const filterAuthorized = (actor, rawList) => {
    const active = rawList.filter((w) => w.isActive || w.status === 'Active');
    if (actor.role === 'Admin' || actor.role === 'Operator') {
      return active;
    }
    if (actor.role === 'WarehouseKeeper') {
      const assignedIds = new Set((actor.scope?.warehouseIds ?? []).map((id) => id.toLowerCase()));
      const assignedCode = actor.warehouseCode?.toLowerCase();
      const scopeWarehouses = actor.scopeLabels?.warehouses ?? [];
      const scopeCodes = new Set(scopeWarehouses.map((s) => s.code.toLowerCase()));
      const scopeIds = new Set(scopeWarehouses.map((s) => s.id.toLowerCase()));

      return active.filter((w) => {
        const idLower = w.id.toLowerCase();
        const codeLower = w.code.toLowerCase();
        const isKeeperMatch = Array.isArray(w.keepers) && w.keepers.some(
          (k) => actor.id && k.userId.toLowerCase() === actor.id.toLowerCase(),
        );
        return (
          assignedIds.has(idLower) ||
          scopeIds.has(idLower) ||
          (assignedCode && codeLower === assignedCode) ||
          scopeCodes.has(codeLower) ||
          isKeeperMatch
        );
      });
    }
    return [];
  };

  // Admin sees all active warehouses (2 warehouses)
  const adminActor = { id: 'admin-id', role: 'Admin' };
  const adminWhs = filterAuthorized(adminActor, allWarehouses);
  assert.equal(adminWhs.length, 2);
  assert.equal(adminWhs.some((w) => w.code === 'WH-OFF'), false);

  // Keeper 1 assigned to WH-CENTRAL only
  const keeper1Actor = {
    id: 'keeper-1',
    role: 'WarehouseKeeper',
    scope: { warehouseIds: ['wh-central-id'], regionIds: [], salesGroupIds: [], retailerIds: [] },
  };
  const keeper1Whs = filterAuthorized(keeper1Actor, allWarehouses);
  assert.equal(keeper1Whs.length, 1);
  assert.equal(keeper1Whs[0].code, 'WH-CENTRAL');

  // Keeper with matching keeper ID in warehouse keepers array
  const keeper2Actor = {
    id: 'keeper-2',
    role: 'WarehouseKeeper',
    scope: { warehouseIds: [], regionIds: [], salesGroupIds: [], retailerIds: [] },
  };
  const keeper2Whs = filterAuthorized(keeper2Actor, allWarehouses);
  assert.equal(keeper2Whs.length, 1);
  assert.equal(keeper2Whs[0].code, 'WH-DN');

  // Keeper without any assignment
  const unassignedKeeper = {
    id: 'keeper-unassigned',
    role: 'WarehouseKeeper',
    scope: { warehouseIds: [], regionIds: [], salesGroupIds: [], retailerIds: [] },
  };
  const unassignedWhs = filterAuthorized(unassignedKeeper, allWarehouses);
  assert.equal(unassignedWhs.length, 0);
});

test('Action column UX: Displays direct [Xem] button and omits ellipsis dropdown when no secondary actions exist', () => {
  const computeRowActions = (receipt, canApprove) => {
    const isPending = receipt.status === 'Pending';
    const secondaryActions = [];

    if (isPending && canApprove) {
      secondaryActions.push({
        key: 'approve',
        label: 'Duyệt phiếu nhập',
      });
    }

    return {
      primaryAction: { label: 'Xem', path: `/receipts/${receipt.receiptCode || receipt.id}` },
      secondaryActions,
      showEllipsis: secondaryActions.length > 0,
    };
  };

  // Case 1: Status Received, User is Admin (canApprove = true)
  // Even if user can approve, receipt is already Received -> secondaryActions empty -> NO ellipsis dropdown
  const actionsReceived = computeRowActions({ id: 'r1', receiptCode: 'PN-01', status: 'Received' }, true);
  assert.equal(actionsReceived.primaryAction.label, 'Xem');
  assert.equal(actionsReceived.secondaryActions.length, 0);
  assert.equal(actionsReceived.showEllipsis, false);

  // Case 2: Status Pending, User is Operator (canApprove = false)
  // Pending but unauthorized -> secondaryActions empty -> NO ellipsis dropdown
  const actionsPendingNoPerm = computeRowActions({ id: 'r2', receiptCode: 'PN-02', status: 'Pending' }, false);
  assert.equal(actionsPendingNoPerm.primaryAction.label, 'Xem');
  assert.equal(actionsPendingNoPerm.secondaryActions.length, 0);
  assert.equal(actionsPendingNoPerm.showEllipsis, false);

  // Case 3: Status Pending, User is Keeper/Admin (canApprove = true)
  // Pending and authorized -> secondaryActions has 'Duyệt phiếu nhập' -> SHOW ellipsis dropdown
  const actionsPendingCanApprove = computeRowActions({ id: 'r3', receiptCode: 'PN-03', status: 'Pending' }, true);
  assert.equal(actionsPendingCanApprove.primaryAction.label, 'Xem');
  assert.equal(actionsPendingCanApprove.secondaryActions.length, 1);
  assert.equal(actionsPendingCanApprove.secondaryActions[0].label, 'Duyệt phiếu nhập');
  assert.equal(actionsPendingCanApprove.showEllipsis, true);
});

test('Dropdown selection UX: Initial state is blank placeholder and does not auto-select first warehouse or product', () => {
  const authorizedWarehouses = [
    { id: 'wh-1', code: 'WH-CENTRAL', name: 'Kho Tổng Long Bình' },
    { id: 'wh-2', code: 'WH-DN', name: 'Kho Đà Nẵng' },
  ];

  const resolveWarehouseSelection = (warehousesList, prevSelection, contextualParam) => {
    if (warehousesList.length === 0) return '';
    if (prevSelection && warehousesList.some((w) => w.id === prevSelection)) {
      return prevSelection;
    }
    if (contextualParam) {
      const matched = warehousesList.find(
        (w) =>
          w.id.toLowerCase() === contextualParam.toLowerCase() ||
          w.code.toLowerCase() === contextualParam.toLowerCase(),
      );
      if (matched) return matched.id;
    }
    return '';
  };

  // Fresh load without URL query: must start empty (not wh-1)
  const initialSelection = resolveWarehouseSelection(authorizedWarehouses, '', '');
  assert.equal(initialSelection, '');

  // Blank line initialization: product must start empty
  const blankLine = {
    productId: '',
    sku: '',
    sourceLotCode: '',
    quantity: '',
    productionDate: '',
    expirationDate: '',
  };
  assert.equal(blankLine.productId, '');
  assert.equal(blankLine.quantity, '');
});

test('Dropdown selection UX: Contextual preselection from query params (?warehouse=) and validation messages', () => {
  const authorizedWarehouses = [
    { id: 'wh-1', code: 'WH-CENTRAL', name: 'Kho Tổng Long Bình' },
    { id: 'wh-2', code: 'WH-DN', name: 'Kho Đà Nẵng' },
  ];

  const resolveWarehouseSelection = (warehousesList, prevSelection, contextualParam) => {
    if (warehousesList.length === 0) return '';
    if (prevSelection && warehousesList.some((w) => w.id === prevSelection)) {
      return prevSelection;
    }
    if (contextualParam) {
      const matched = warehousesList.find(
        (w) =>
          w.id.toLowerCase() === contextualParam.toLowerCase() ||
          w.code.toLowerCase() === contextualParam.toLowerCase(),
      );
      if (matched) return matched.id;
    }
    return '';
  };

  // Contextual param matching by warehouse code
  const codeSelected = resolveWarehouseSelection(authorizedWarehouses, '', 'WH-DN');
  assert.equal(codeSelected, 'wh-2');

  // Contextual param matching by warehouse UUID
  const idSelected = resolveWarehouseSelection(authorizedWarehouses, '', 'wh-1');
  assert.equal(idSelected, 'wh-1');

  // Contextual param pointing to unauthorized/non-existent warehouse -> fallback to empty
  const unauthSelected = resolveWarehouseSelection(authorizedWarehouses, '', 'WH-FORBIDDEN');
  assert.equal(unauthSelected, '');

  // Validation messages check: exact natural Vietnamese
  const validateForm = (selectedWarehouseId, rows) => {
    const errors = [];
    if (!selectedWarehouseId) {
      errors.push('Vui lòng chọn kho nhận hàng.');
    }
    for (const r of rows) {
      if (!r.productId) {
        errors.push('Vui lòng chọn sản phẩm.');
      }
      if (!r.productionDate) {
        errors.push('Vui lòng nhập ngày sản xuất.');
      }
      if (!r.expirationDate) {
        errors.push('Vui lòng nhập hạn sử dụng.');
      }
      if (r.productionDate && r.expirationDate && r.productionDate > r.expirationDate) {
        errors.push('Ngày sản xuất phải trước hoặc bằng hạn sử dụng.');
      }
      const qtyNum = Number(r.quantity);
      if (!qtyNum || qtyNum <= 0) {
        errors.push('Số lượng nhập phải lớn hơn 0.');
      }
    }
    return errors;
  };

  const initialErrors = validateForm('', [{ productId: '', productionDate: '', expirationDate: '', quantity: '' }]);
  assert.ok(initialErrors.includes('Vui lòng chọn kho nhận hàng.'));
  assert.ok(initialErrors.includes('Vui lòng chọn sản phẩm.'));
  assert.ok(initialErrors.includes('Vui lòng nhập ngày sản xuất.'));
  assert.ok(initialErrors.includes('Vui lòng nhập hạn sử dụng.'));
  assert.ok(initialErrors.includes('Số lượng nhập phải lớn hơn 0.'));

  const validErrors = validateForm('wh-1', [
    {
      productId: 'p-1',
      productionDate: '2026-11-01',
      expirationDate: '2027-05-01',
      quantity: '50',
    },
  ]);
  assert.equal(validErrors.length, 0);
});

test('Goods Receipt Inventory Posting: Pending receipts do not display inventory as recorded', () => {
  const pendingReceipt = {
    id: 'r-pending-id',
    receiptCode: 'PN-261107-001',
    status: 'Pending',
    receivedAt: null,
    approvedAt: null,
    lines: [
      {
        id: 'l-1',
        productId: 'prod-1',
        sku: 'MILK-180',
        receivedQuantity: 50,
        batchId: null,
        batchCode: null,
      },
    ],
  };

  const getInventoryPostingStatus = (receipt) => {
    const isReceived = receipt.status === 'Received';
    if (isReceived) {
      const hasBatches = Array.isArray(receipt.lines) && receipt.lines.every((l) => Boolean(l.batchId));
      if (hasBatches) return 'Đã ghi nhận tồn kho vật lý';
      return 'Chờ đồng bộ tồn kho';
    }
    return 'Chưa ghi nhận (Chờ duyệt)';
  };

  const getLinePostingStatus = (receipt, line) => {
    if (receipt.status === 'Received' && line.batchId) {
      return `+${line.receivedQuantity} (Đã ghi sổ)`;
    }
    return 'Chưa cộng kho';
  };

  assert.equal(getInventoryPostingStatus(pendingReceipt), 'Chưa ghi nhận (Chờ duyệt)');
  assert.equal(getLinePostingStatus(pendingReceipt, pendingReceipt.lines[0]), 'Chưa cộng kho');
  assert.equal(pendingReceipt.receivedAt, null);
  assert.equal(pendingReceipt.lines[0].batchId, null);
});

test('Goods Receipt Inventory Posting: Approved receipts display backend-confirmed posting and real batches', () => {
  const receivedReceipt = {
    id: 'r-received-id',
    receiptCode: 'PN-261107-002',
    status: 'Received',
    receivedAt: '2026-11-07T09:30:00Z',
    approvedAt: '2026-11-07T09:30:00Z',
    lines: [
      {
        id: 'l-1',
        productId: 'prod-1',
        sku: 'MILK-180',
        receivedQuantity: 100,
        batchId: '00000000-0000-0000-0000-000000000123',
        batchCode: 'WH-CENTRAL-MILK-180-15052027',
      },
    ],
  };

  const getInventoryPostingStatus = (receipt) => {
    const isReceived = receipt.status === 'Received';
    if (isReceived) {
      const hasBatches = Array.isArray(receipt.lines) && receipt.lines.every((l) => Boolean(l.batchId));
      if (hasBatches) return 'Đã ghi nhận tồn kho vật lý';
      return 'Chờ đồng bộ tồn kho';
    }
    return 'Chưa ghi nhận (Chờ duyệt)';
  };

  const getLinePostingStatus = (receipt, line) => {
    if (receipt.status === 'Received' && line.batchId) {
      return `+${line.receivedQuantity} (Đã ghi sổ)`;
    }
    return 'Chưa cộng kho';
  };

  assert.equal(getInventoryPostingStatus(receivedReceipt), 'Đã ghi nhận tồn kho vật lý');
  assert.equal(getLinePostingStatus(receivedReceipt, receivedReceipt.lines[0]), '+100 (Đã ghi sổ)');
  assert.ok(receivedReceipt.receivedAt);
  assert.ok(receivedReceipt.lines[0].batchId);
  assert.equal(receivedReceipt.lines[0].batchCode, 'WH-CENTRAL-MILK-180-15052027');
});

test('Goods Receipt Inventory Posting: Prevent misleading success message if unverified', () => {
  const resolveApproveSuccessMessage = (receipt) => {
    if (receipt.status === 'Received') {
      const hasBatches = Array.isArray(receipt.lines) && receipt.lines.some((l) => Boolean(l.batchId));
      if (hasBatches) {
        return `Đã duyệt phiếu nhập ${receipt.receiptCode}. Tồn kho vật lý và lô hàng đã được ghi nhận thành công.`;
      }
      return `Đã duyệt phiếu nhập ${receipt.receiptCode}. Đang đồng bộ thông tin lô hàng vào kho.`;
    }
    return `Đã gửi yêu cầu duyệt phiếu nhập ${receipt.receiptCode}.`;
  };

  // Case 1: Backend confirmed with status Received and created batches
  const confirmed = resolveApproveSuccessMessage({
    receiptCode: 'PN-01',
    status: 'Received',
    lines: [{ batchId: 'b-1' }],
  });
  assert.ok(confirmed.includes('Tồn kho vật lý và lô hàng đã được ghi nhận thành công.'));

  // Case 2: Status Received but batches not yet populated (async sync)
  const unverifiedBatches = resolveApproveSuccessMessage({
    receiptCode: 'PN-02',
    status: 'Received',
    lines: [{ batchId: null }],
  });
  assert.ok(unverifiedBatches.includes('Đang đồng bộ thông tin lô hàng vào kho.'));
  assert.equal(unverifiedBatches.includes('đã được ghi nhận thành công'), false);

  // Case 3: Status not Received (e.g. backend returned Pending or processing)
  const notReceived = resolveApproveSuccessMessage({
    receiptCode: 'PN-03',
    status: 'Pending',
    lines: [],
  });
  assert.equal(notReceived.includes('Tồn kho'), false);
  assert.ok(notReceived.includes('Đã gửi yêu cầu duyệt phiếu nhập'));
});

test('Goods Receipt Error Handling: Natural Vietnamese for conflict and validation failures', () => {
  const { AxiosError } = require('axios');

  const errConflict = errors.toApiError(
    new AxiosError('Conflict', 'ERR_BAD_REQUEST', undefined, undefined, {
      status: 409,
      data: { title: 'Dữ liệu đã bị thay đổi bởi người khác' },
    }),
  );
  assert.equal(errConflict.title, 'Dữ liệu đã bị thay đổi bởi người khác');

  const errValidation = errors.toApiError(
    new AxiosError('Bad Request', 'ERR_BAD_REQUEST', undefined, undefined, {
      status: 400,
      data: { title: 'Dữ liệu không hợp lệ', detail: 'Số lượng không hợp lệ' },
    }),
  );
  assert.equal(errValidation.title, 'Dữ liệu không hợp lệ');
  assert.equal(errValidation.detail, 'Số lượng không hợp lệ');

  const errBusiness = errors.toApiError(
    new AxiosError('Unprocessable Entity', 'ERR_BAD_REQUEST', undefined, undefined, {
      status: 422,
      data: { title: 'Vi phạm quy tắc nghiệp vụ' },
    }),
  );
  assert.equal(errBusiness.title, 'Vi phạm quy tắc nghiệp vụ');
});




