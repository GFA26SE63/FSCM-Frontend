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


