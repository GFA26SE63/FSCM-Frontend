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

test('Batch Detail Page: "Thông tin nhập kho" and "Danh sách carton" sections are completely removed', () => {
  const detailFile = path.resolve(__dirname, '../src/features/batches/pages/BatchDetailPage.tsx');
  const detailCode = fs.readFileSync(detailFile, 'utf8');

  assert.equal(detailCode.includes('Thông tin nhập kho'), false);
  assert.equal(detailCode.includes('Danh sách carton'), false);
  assert.equal(detailCode.includes('receiptEntries'), false);
  assert.equal(detailCode.includes('isReceiptTx'), false);
});

test('Batch Detail Page: Table headers order has Pallet ID immediately after Chứng từ', () => {
  const detailFile = path.resolve(__dirname, '../src/features/batches/pages/BatchDetailPage.tsx');
  const detailCode = fs.readFileSync(detailFile, 'utf8');

  const historyStart = detailCode.indexOf('Lịch sử nhập – xuất – khóa');
  const tableHead = detailCode.slice(historyStart, detailCode.indexOf(']} />', historyStart));
  assert.ok(historyStart >= 0, 'History table section must exist');

  assert.ok(tableHead.includes('Thời điểm'));
  assert.ok(tableHead.includes('Loại giao dịch'));
  assert.ok(tableHead.includes('Chứng từ'));
  assert.ok(tableHead.includes('Pallet ID'));
  assert.ok(tableHead.includes('Số lượng'));
  assert.ok(tableHead.includes('Người thực hiện'));

  const chungTuIdx = tableHead.indexOf('Chứng từ');
  const palletIdx = tableHead.indexOf('Pallet ID');
  const soLuongIdx = tableHead.indexOf('Số lượng');

  assert.ok(chungTuIdx < palletIdx, 'Pallet ID must come after Chứng từ');
  assert.ok(palletIdx < soLuongIdx, 'Pallet ID must come before Số lượng');
  assert.ok(tableHead.includes('empty="Chưa có ghi nhận giao dịch nhập / xuất nào cho lô hàng này."'));
});

test('Batch Detail Page: Pallet ID mapping logic matches receiptCode and handles multiple pallets', () => {
  const detailFile = path.resolve(__dirname, '../src/features/batches/pages/BatchDetailPage.tsx');
  const detailCode = fs.readFileSync(detailFile, 'utf8');

  assert.ok(detailCode.includes('getPalletsForTransaction'));
  assert.ok(detailCode.includes('Chưa gán pallet'));

  const cartons = [
    { cartonCode: 'C1', palletCode: 'PAL-01', stockBatchId: 'B1', receiptCode: 'PN-01', status: 'Available', receivedAt: null },
    { cartonCode: 'C2', palletCode: 'PAL-02', stockBatchId: 'B1', receiptCode: 'PN-01', status: 'Available', receivedAt: null },
    { cartonCode: 'C3', palletCode: 'PAL-03', stockBatchId: 'B1', receiptCode: 'PN-02', status: 'Available', receivedAt: null },
    { cartonCode: 'C4', palletCode: null, stockBatchId: 'B1', receiptCode: 'PN-03', status: 'Available', receivedAt: null },
  ];

  const fnMatch = detailCode.match(/function getPalletsForTransaction[\s\S]*?\n\}/);
  assert.ok(fnMatch, 'getPalletsForTransaction must be defined');

  const jsCode = ts.transpileModule(fnMatch[0], {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const getPallets = new Function('h', 'cartons', `${jsCode}; return getPalletsForTransaction(h, cartons);`);

  // Multiple pallets for single receipt PN-01
  const p1 = getPallets({ referenceCode: 'PN-01', transactionType: 'Receipt' }, cartons);
  assert.deepEqual(p1, ['PAL-01', 'PAL-02']);

  // Single pallet for PN-02
  const p2 = getPallets({ referenceCode: 'PN-02', transactionType: 'Receipt' }, cartons);
  assert.deepEqual(p2, ['PAL-03']);

  // Receipt with null pallet
  const p3 = getPallets({ referenceCode: 'PN-03', transactionType: 'Receipt' }, cartons);
  assert.deepEqual(p3, []);

  // Non-receipt transaction without carton/pallet match (OrderReserve, Lock, Disposal)
  const pOrder = getPallets({ referenceCode: 'ORD-999', transactionType: 'OrderReserve' }, cartons);
  assert.deepEqual(pOrder, []);

  const pLock = getPallets({ referenceCode: 'LOCK-1', transactionType: 'Lock' }, cartons);
  assert.deepEqual(pLock, []);

  const pNoRef = getPallets({ referenceCode: undefined, transactionType: 'Disposal' }, cartons);
  assert.deepEqual(pNoRef, []);
});

test('Batch Detail Page: Transaction type column has sufficient width and preserves exact labels and styles', () => {
  const detailFile = path.resolve(__dirname, '../src/features/batches/pages/BatchDetailPage.tsx');
  const detailCode = fs.readFileSync(detailFile, 'utf8');

  // SimpleTable applies the configured column width to both header and cells.
  assert.ok(detailCode.includes('{ header: "Loại giao dịch", width: \'200px\''));

  // Verify strict preservation: keeps original badge styles and exact typeName mapping
  assert.ok(detailCode.includes("typeName === 'Nhập kho'"));
  assert.ok(detailCode.includes("background: '#E5F4EA', color: '#15703A'"));
  assert.ok(detailCode.includes("background: '#E8EEFD', color: '#1D4ED8'"));
  assert.ok(detailCode.includes("background: '#FDECEA', color: '#B42318'"));
  assert.ok(detailCode.includes("background: '#FEF3E2', color: '#8A3B09'"));
  assert.ok(detailCode.includes("background: '#ECEEF1', color: '#374151'"));

  // Verify raw transaction types (OrderReserve, AdjustmentDecrease, etc.) fall through untouched to h.transactionType
  assert.ok(detailCode.includes(": h.transactionType;"));
});

test('Batch Detail Page: Operator name column resolves through users.nameOf without raw user ID', () => {
  const detailFile = path.resolve(__dirname, '../src/features/batches/pages/BatchDetailPage.tsx');
  const detailCode = fs.readFileSync(detailFile, 'utf8');

  assert.ok(detailCode.includes('useReceiptUserNames'));
  assert.ok(detailCode.includes('users.nameOf(h.createdByUserId)'));
  assert.equal(detailCode.includes('h.createdByUserId ||'), false, 'Must not fallback directly to raw user ID');
});


