const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function source(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith('.') || name.startsWith('@/')) throw new Error(`Missing mock ${name}`);
    return require(name);
  }, module, module.exports);
  return module.exports;
}

const statuses = source('shared/lib/status.ts');
const filters = source('shared/ui/tableFilterLabels.ts');

test('Vietnamese navigation preserves the new warehouse routes, document paths and role access', () => {
  const { APP_ROUTES } = source('app/routes.tsx');
  const workflow = source('features/warehouse-work/workflow.ts');
  const expected = [
    ['warehouse-inbound', 'inbound', 'Nhập kho'],
    ['warehouse-receipts', 'receipts', 'Phiếu nhập kho (PNK)'],
    ['warehouse-outbound', 'outbound', 'Xuất kho'],
    ['warehouse-issues', 'issues', 'Phiếu xuất kho (PXK)'],
    ['warehouse-transfers', 'transfer', 'Luân chuyển kho'],
    ['warehouse-trace', 'trace', 'Tra cứu thùng'],
  ];
  for (const [key, kind, title] of expected) {
    const route = APP_ROUTES.find(item => item.key === key);
    assert.ok(route, key);
    assert.equal(route.label, title);
    assert.deepEqual(route.roles, ['Admin', 'WarehouseKeeper']);
    assert.equal(workflow.warehouseScreens[kind].path, '/' + key);
    if (kind !== 'trace') assert.deepEqual(route.sub.map(item => item.path), ['new', ':documentId']);
  }
  assert.equal(APP_ROUTES.find(item => item.key === 'warehouse-work').hidden, true);
  assert.equal(workflow.warehouseDocumentPath({ id: 'receipt-1', reason: 'Factory' }), '/warehouse-inbound/receipt-1');
  assert.equal(workflow.warehouseDocumentPath({ id: 'issue-1', reason: 'Order' }), '/warehouse-outbound/issue-1');
  assert.equal(workflow.warehouseDocumentPath({ id: 'transfer-1', reason: 'Transfer' }), '/warehouse-transfers/transfer-1');
});

test('dashboard translates server card text while preserving figures, links and unknown content', () => {
  const { dashboardCardCopy, dashboardText } = source('features/dashboard/dashboardCopy.ts');
  const original = {
    key: 'shipmentsReady', label: 'Shipment chờ xuất', value: 17, unit: 'count',
    note: 'Tại các kho trong bộ lọc · kiểm tra readiness trước xuất', tone: 'warn', href: '/readiness', previousValue: 9
  };
  assert.deepEqual(dashboardCardCopy(original), {
    ...original, label: 'Phiếu giao hàng chờ xuất',
    note: 'Tại các kho trong bộ lọc · kiểm tra điều kiện trước khi xuất kho'
  });
  assert.equal(original.label, 'Shipment chờ xuất');
  assert.equal(dashboardText('Đang chờ Retailer xác nhận PO'), 'Đang chờ nhà bán lẻ xác nhận báo giá');
  assert.equal(dashboardText('Shipment ngoại lệ'), 'Phiếu giao hàng cần xử lý phát sinh');
  assert.equal(dashboardText('Khu vực / nhóm Sales được quản lý'), 'Khu vực / nhóm bán hàng được quản lý');
  const fill = { ...original, key: 'fillRate', note: '1,234/2,000 thùng retailer xác nhận nhận' };
  assert.equal(dashboardCardCopy(fill).note, '1,234/2,000 thùng nhà bán lẻ xác nhận nhận');
  assert.equal(dashboardText('Retailer ABC · Shipment 123: user-entered reason'), 'Retailer ABC · Shipment 123: user-entered reason');
  assert.equal(dashboardCardCopy({ ...original, note: 'Unknown server note' }).note, 'Unknown server note');
});

test('Vietnamese role labels retain the authorization codes and portal role membership', () => {
  const roles = source('shared/auth/roles.ts');
  assert.deepEqual(roles.PORTAL_ROLES, ['Admin', 'Operator', 'WarehouseKeeper', 'SalesManager']);
  assert.equal(roles.roleLabel.Sales, 'Nhân viên bán hàng');
  assert.equal(roles.roleLabel.Retailer, 'Nhà bán lẻ');
  assert.equal(roles.isPortalRole('Sales'), false);
  assert.equal(roles.isPortalRole('Admin'), true);
});

test('saved list filter URLs survive translated labels without rewriting API values or real names', () => {
  assert.equal(filters.tableFilterParam('Nhóm bán hàng'), 'nhomsales');
  assert.equal(filters.tableFilterParam('Nhà bán lẻ'), 'diemban');
  assert.equal(filters.tableFilterParam('Lô hàng'), 'lohang');
  assert.equal(filters.tableFilterParam('Trạng thái'), 'trangthai');
  assert.equal(filters.tableFilterValue('Inactive', ['Nháp', 'Ngừng bán']), 'Ngừng bán');
  assert.equal(filters.tableFilterValue('Inactive', ['Hoạt động', 'Ngừng hoạt động']), 'Ngừng hoạt động');
  assert.equal(filters.tableFilterValue('Đã publish', ['Đang bán']), 'Đang bán');
  assert.equal(filters.tableFilterValue('Online', ['Trực tuyến']), 'Trực tuyến');
  assert.equal(filters.tableFilterValue('Nháp', ['Nháp']), 'Nháp');
  assert.equal(filters.tableFilterValue('Admin', ['Admin', 'Quản trị viên']), 'Admin');
  assert.equal(filters.tableFilterValue('Unknown state', ['Nháp']), 'Unknown state');
});

test('status translation keeps delivery distinct from financial completion and retains chip tones', () => {
  const { statusLabel } = statuses;
  const { toneOf } = source('shared/ui/StatusChip.tsx', { '../lib/status': statuses });
  assert.equal(statusLabel('order', 'Delivered'), 'Đã giao');
  assert.equal(statusLabel('order', 'Completed'), 'Hoàn tất');
  assert.equal(statusLabel('product', 'Inactive'), 'Ngừng bán');
  assert.equal(statusLabel('active', 'Inactive'), 'Ngừng hoạt động');
  assert.equal(toneOf(statusLabel('product', 'Published')), 'ok');
  assert.equal(statusLabel('product', 'Draft'), 'Nháp');
  assert.equal(toneOf(statusLabel('product', 'Draft')), 'info');
  assert.equal(statusLabel('expirySweep', 'Completed'), 'Đã hoàn tất kiểm tra');
  assert.equal(toneOf(statusLabel('channel', 'Offline')), 'dark');
  assert.equal(toneOf(statusLabel('receivable', 'PartiallyPaid')), 'warn');
  assert.equal(statusLabel('shipment', 'NewServerState'), 'NewServerState');
});

test('dashboard statuses use the document domain instead of treating all Completed codes as orders', () => {
  const { workItemStatus } = source('features/dashboard/workItemStatus.ts', {
    '@/shared/lib/status': statuses,
    '@/features/refunds/types': source('features/refunds/types.ts'),
  });
  assert.equal(workItemStatus('picking', 'Completed'), 'Đã soạn xong');
  assert.equal(workItemStatus('allocation', 'Completed'), 'Hoàn tất');
  assert.equal(workItemStatus('redemption', 'Delivered'), 'Đang giao quà');
  assert.equal(workItemStatus('refund', 'AwaitingVerification'), 'Chờ quản trị viên xác minh');
  assert.equal(workItemStatus('future-kind', 'FutureState'), 'FutureState');
});

test('localized API errors retain machine codes, field names, original evidence and unknown business details', () => {
  const { ApiError, errorMessage } = source('shared/api/errors.ts');
  const error = new ApiError(409, 'Conflict', 'The requested reward quantity is not available.', 'reward_quantity', {
    Quantity: ['Quantity must be greater than zero.'],
    RetailerName: ['Store ABC must be reviewed by manager Jane'],
  });
  assert.equal(error.status, 409);
  assert.equal(error.code, 'reward_quantity');
  assert.equal(error.originalTitle, 'Conflict');
  assert.equal(error.originalDetail, 'The requested reward quantity is not available.');
  assert.equal(error.field('quantity'), 'Số lượng phải lớn hơn 0.');
  assert.equal(error.field('RetailerName'), 'Store ABC must be reviewed by manager Jane');
  assert.deepEqual(Object.keys(error.fieldErrors), ['Quantity', 'RetailerName']);
  assert.equal(errorMessage(error), [
    'Xung đột dữ liệu (HTTP 409 · Mã: reward_quantity)',
    'Không đủ số lượng quà để đáp ứng yêu cầu.',
    'Quantity: Số lượng phải lớn hơn 0.',
    'RetailerName: Store ABC must be reviewed by manager Jane',
  ].join('\n'));
});
