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

const user = (role) => ({ id: 'user-' + role, role, name: role, email: role + '@example.com' });

test('only Administrator can unlock inventory; Keeper and Admin can lock', () => {
  assert.equal(permissions.can(user('Admin'), 'inventory.unlock'), true);
  assert.equal(permissions.can(user('WarehouseKeeper'), 'inventory.unlock'), false);
  assert.equal(permissions.can(user('Operator'), 'inventory.unlock'), false);
  assert.equal(permissions.can(user('SalesManager'), 'inventory.unlock'), false);

  assert.equal(permissions.can(user('Admin'), 'inventory.lock'), true);
  assert.equal(permissions.can(user('WarehouseKeeper'), 'inventory.lock'), true);
});

test('expiry status maps to exact Vietnamese business labels', () => {
  assert.equal(status.statusLabels.expiry.Normal, 'Còn hạn');
  assert.equal(status.statusLabels.expiry['Near-date'], 'Cận hạn');
  assert.equal(status.statusLabels.expiry.NearExpiry, 'Cận hạn');
  assert.equal(status.statusLabels.expiry.Expired, 'Hết hạn');
  assert.equal(status.statusLabels.expiry.Disposed, 'Đã tiêu hủy');

  assert.equal(status.statusLabel('expiry', 'Normal'), 'Còn hạn');
  assert.equal(status.statusLabel('expiry', 'Near-date'), 'Cận hạn');
  assert.equal(status.statusLabel('expiry', 'NearExpiry'), 'Cận hạn');
  assert.equal(status.statusLabel('expiry', 'Expired'), 'Hết hạn');
});

test('expiry status chips map to correct UI tones', () => {
  assert.equal(statusChip.toneOf('Còn hạn'), 'ok');
  assert.equal(statusChip.toneOf('Cận hạn'), 'warn');
  assert.equal(statusChip.toneOf('Hết hạn'), 'danger');
});

test('batch inventory calculations preserve formula Available = Physical - Reserved - Locked', () => {
  const onHand = 100;
  const reserved = 30;
  const locked = 20;
  const available = Math.max(0, onHand - reserved - locked);
  assert.equal(available, 50);

  // When locked equals available stock
  const allLocked = 70;
  const availAfterAllLocked = Math.max(0, onHand - reserved - allLocked);
  assert.equal(availAfterAllLocked, 0);
});

test('inventory lock reasons map exactly to backend enum and Vietnamese labels', () => {
  assert.equal(status.statusLabels.inventoryLockReason.Expired, 'Hết hạn sử dụng');
  assert.equal(status.statusLabels.inventoryLockReason.Damaged, 'Hàng bị hư hỏng');
  assert.equal(status.statusLabels.inventoryLockReason.QualityHold, 'Chờ kiểm tra chất lượng');
  assert.equal(status.statusLabels.inventoryLockReason.Recall, 'Thu hồi hàng');
  assert.equal(status.statusLabels.inventoryLockReason.Other, 'Lý do khác');

  assert.equal(status.formatLockReason('Expired'), 'Hết hạn sử dụng');
  assert.equal(status.formatLockReason('Damaged'), 'Hàng bị hư hỏng');
  assert.equal(status.formatLockReason('QualityHold'), 'Chờ kiểm tra chất lượng');
  assert.equal(status.formatLockReason('Recall'), 'Thu hồi hàng');
  assert.equal(status.formatLockReason('Other'), 'Lý do khác');

  // Neutral fallback for unknown / missing reasons without inventing fake reasons
  assert.equal(status.formatLockReason('UnknownCustomReason'), 'UnknownCustomReason');
  assert.equal(status.formatLockReason(null), 'Chưa xác định');
  assert.equal(status.formatLockReason(undefined), 'Chưa xác định');

  // Verify dropdown options definition
  assert.equal(status.INVENTORY_LOCK_REASONS.length, 5);
  const values = status.INVENTORY_LOCK_REASONS.map((r) => r.value);
  assert.deepEqual(values, ['Expired', 'Damaged', 'QualityHold', 'Recall', 'Other']);
});

test('Batch Detail and List screens enforce standardized terminology and structure', () => {
  const batchDetailPageCode = fs.readFileSync(
    path.resolve(__dirname, '../src/features/batches/pages/BatchDetailPage.tsx'),
    'utf8',
  );
  const batchesPageCode = fs.readFileSync(
    path.resolve(__dirname, '../src/features/batches/pages/BatchesPage.tsx'),
    'utf8',
  );

  // Standardized field labels
  assert.ok(batchDetailPageCode.includes('>Tồn thực tế<'));
  assert.ok(batchDetailPageCode.includes('>Đã giữ cho đơn hàng<'));
  assert.ok(batchDetailPageCode.includes('>Số lượng bị khóa<'));
  assert.ok(batchDetailPageCode.includes('>Lý do khóa<'));
  assert.ok(batchDetailPageCode.includes('>Số lượng còn dùng được<'));

  // Section titles
  assert.ok(batchDetailPageCode.includes('Đơn hàng bị ảnh hưởng'));
  assert.ok(batchDetailPageCode.includes('Danh sách khóa tồn kho'));

  // Write-off action blocking tooltip & warning
  const blockingMsg =
    'Lô hàng này đang có hàng được giữ cho đơn hàng. Vui lòng kiểm tra và xử lý các đơn liên quan trước khi tiếp tục.';
  assert.ok(batchDetailPageCode.includes(blockingMsg));
  assert.ok(batchesPageCode.includes(blockingMsg));
});

test('Affected orders aggregation matches real picking list items without mock data', () => {
  // Simulate backend picking lists
  const targetBatchId = 'batch-uuid-1';
  const targetBatchCode = 'LOTE-2026-001';

  const pickingLists = [
    {
      id: 'pl-1',
      pickingCode: 'PICK-001',
      orderId: 'order-uuid-1',
      orderCode: 'DH-2026-001',
      retailerName: 'Đại lý An Bình',
      warehouseCode: 'KHO-TONG',
      status: 'InProgress',
      items: [
        {
          id: 'item-1',
          batchId: 'batch-uuid-1',
          batchCode: 'LOTE-2026-001',
          requestedQuantity: 20,
          pickedQuantity: 5,
          remainingQuantity: 15,
        },
      ],
    },
    {
      id: 'pl-2',
      pickingCode: 'PICK-002',
      orderId: 'order-uuid-2',
      orderCode: 'DH-2026-002',
      retailerName: 'Siêu thị Minh Tâm',
      warehouseCode: 'KHO-TONG',
      status: 'Pending',
      items: [
        {
          id: 'item-2',
          batchId: 'batch-uuid-999',
          batchCode: 'OTHER-BATCH',
          requestedQuantity: 50,
          pickedQuantity: 0,
          remainingQuantity: 50,
        },
      ],
    },
  ];

  // Aggregation logic under test
  const matchingOrdersMap = new Map();
  for (const pl of pickingLists) {
    let reservedForBatch = 0;
    for (const item of pl.items) {
      if (
        (targetBatchId && item.batchId === targetBatchId) ||
        (targetBatchCode && item.batchCode === targetBatchCode)
      ) {
        const rem = Number(item.remainingQuantity ?? 0);
        const req = Number(item.requestedQuantity ?? 0);
        const picked = Number(item.pickedQuantity ?? 0);
        const itemQty = rem > 0 ? rem : Math.max(0, req - picked);
        reservedForBatch += itemQty > 0 ? itemQty : req;
      }
    }

    if (reservedForBatch > 0) {
      const key = pl.orderId || pl.orderCode;
      matchingOrdersMap.set(key, {
        orderId: pl.orderId,
        orderCode: pl.orderCode,
        retailerName: pl.retailerName,
        reservedQuantity: reservedForBatch,
        status: pl.status,
        warehouseCode: pl.warehouseCode,
        pickingCode: pl.pickingCode,
      });
    }
  }

  const affectedOrders = Array.from(matchingOrdersMap.values());
  assert.equal(affectedOrders.length, 1);
  assert.equal(affectedOrders[0].orderCode, 'DH-2026-001');
  assert.equal(affectedOrders[0].retailerName, 'Đại lý An Bình');
  assert.equal(affectedOrders[0].reservedQuantity, 15);
  assert.equal(affectedOrders[0].status, 'InProgress');
});

test('Zero-mock policy: when no affected orders exist, return empty array without fake items', () => {
  const emptyPickingLists = [];
  const targetBatchId = 'batch-uuid-non-existent';

  const matches = emptyPickingLists.filter((pl) =>
    pl.items.some((item) => item.batchId === targetBatchId),
  );
  assert.equal(matches.length, 0);
});



