const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const read = (file) => fs.readFileSync(path.resolve(__dirname, '../src', file), 'utf8');
function load(file) {
  const code = ts.transpileModule(read(file), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(require, module, module.exports);
  return module.exports;
}

test('pallet receiving asks for confirmation before "Xác nhận kết quả và nhận pallet"', () => {
  const src = read('features/warehouse-work/PalletReceiving.tsx');
  assert.ok(src.includes('onClick={() => setConfirming(true)}>Xác nhận kết quả và nhận pallet'));
  assert.ok(!src.includes('onClick={() => void receive()}'), 'receive must only run from the ConfirmDialog');
  assert.ok(src.includes('<ConfirmDialog') && src.includes('onConfirm={async () => { await receive();'));
});

test('pallet receiving trims "Lý do thiếu/hỏng" and "Vị trí cách ly" on blur and when sending', () => {
  const src = read('features/warehouse-work/PalletReceiving.tsx');
  assert.ok(src.includes("onBlur={e => update(r.cartonCode, { reason: e.target.value.trim() })}"));
  assert.ok(src.includes("onBlur={e => update(r.cartonCode, { quarantineLocation: e.target.value.trim() })}"));
  assert.ok(src.includes('cartons: rows.map(trimmed)'));
  assert.match(src, /const trimmed = \(r: Inspection\): Inspection => \(\{ \.\.\.r, reason: r\.reason\.trim\(\), quarantineLocation: r\.quarantineLocation\.trim\(\) \}\)/);
});

test('pallet receiving action rows and scan history are spaced apart', () => {
  const src = read('features/warehouse-work/PalletReceiving.tsx');
  assert.equal((src.match(/className="pallet-receiving-actions"/g) ?? []).length, 2);
  assert.ok(src.includes('<h3 className="pallet-receiving-history">Lịch sử quét pallet trên phiếu</h3>'));
  const css = read('features/warehouse-work/warehouse-work.css');
  assert.match(css, /\.pallet-receiving-actions \{[^}]*gap: 12px;[^}]*margin: 16px 0;/);
  assert.match(css, /\.pallet-receiving-history \{ margin: 28px 0 10px; \}/);
  assert.match(css, /\.pallet-camera \{ margin-bottom: 16px; \}/);
});

test('receipt, outbound and transfer lists show carton counts without an order count', () => {
  const src = read('features/warehouse-work/index.tsx');
  const pnk = src.slice(src.indexOf("'Danh sách Phiếu Nhập Kho (PNK)'"), src.indexOf("'Danh sách Phiếu Xuất Luân Chuyển (PXK)'"));
  assert.ok(pnk.includes("header: 'Số thùng'"));
  assert.ok(!pnk.includes('đơn ·'));
  assert.ok(src.includes("...(d.kind === 'Receipt' ? [] : [{ header: 'Đơn hàng'"));
  // Outbound and transfer lists do not show a zero order count for non-order documents.
  const pxk = src.slice(src.indexOf("'Danh sách Phiếu Xuất Luân Chuyển (PXK)'"));
  assert.ok(!pxk.includes("header: 'Đơn / thùng'"));
  assert.ok(pxk.includes("header: 'Số thùng'"));
  assert.ok(src.includes('Danh sách lệnh điều chuyển kho'));
});

test('delivery dispatch follows warehouse transfers in the warehouse sidebar', () => {
  const sidebar = read('app/layout/Sidebar.tsx');
  const transfers = sidebar.indexOf("'warehouse-transfers'");
  const readiness = sidebar.indexOf("'readiness'");
  const fleet = sidebar.indexOf("'fleet'");
  assert.ok(transfers >= 0 && readiness > transfers && fleet > readiness);
});

test('transport dispatch nests delivery and transfer request/history tabs', () => {
  const page = read('features/shipments/pages/OrderReadinessPage.tsx');
  const routes = read('app/routes.tsx');
  assert.match(routes, /key: 'readiness', label: 'Điều phối vận tải'/);
  assert.ok(page.includes('title="Điều phối vận tải"'));
  assert.ok(page.includes("label: 'Điều phối giao hàng'"));
  assert.ok(page.includes("label: 'Điều phối luân chuyển'"));
  assert.ok(page.includes('Yêu cầu Điều phối ${operation}'));
  assert.ok(page.includes('Lịch sử Điều phối ${operation}'));
  assert.ok(page.includes('warehouseTransfers(first: 100, after: $after'));
  assert.ok(page.includes('pageInfo { hasNextPage endCursor }'));
});

test('transfer dispatch assignment sends driver, vehicle and optimistic version', () => {
  const page = read('features/shipments/pages/OrderReadinessPage.tsx');
  const api = read('features/shipments/api.ts');
  assert.ok(api.includes('/transport-dispatches/transfers/${input.transferId}/assignment'));
  assert.ok(api.includes('driverId: input.driverId'));
  assert.ok(api.includes('vehicleId: input.vehicleId'));
  assert.ok(api.includes('expectedVersion: input.expectedVersion'));
  assert.ok(page.includes('shipmentsApi.assignTransfer'));
  assert.ok(page.includes("selected.status === 'Approved'"));
  assert.ok(page.includes('item.warehouseId === selected.sourceWarehouseId'));
  assert.ok(page.includes('Gán xe và tài xế'));
});

test('loyalty report displays period net point flow (received / used) and card points balance', () => {
  const page = read('features/reports/LoyaltyReportView.tsx');
  assert.ok(page.includes('Biến động điểm trong kỳ'));
  assert.ok(page.includes('Tăng +${formatNumber(s.periodEarnedPoints)} · Giảm −${formatNumber(s.periodUsedPoints)}'));
  const table = read('shared/ui/SimpleTable.tsx');
  assert.ok(table.includes('<tr className="tbl-total">'));
});

test('warehouse report loads only the warehouses the user picked', () => {
  const model = load('features/warehouse-report/warehouseReportModel.ts');
  const all = [
    { id: 'b', code: 'WH-B', name: 'Kho B', regionId: 'r1' },
    { id: 'a', code: 'WH-A', name: 'Kho A', regionId: 'r1' },
    { id: 'c', code: 'WH-C', name: 'Kho C', regionId: 'r2' },
  ];
  assert.deepEqual(model.selectableWarehouses(all, '').map((w) => w.id), ['a', 'b', 'c']);
  assert.deepEqual(model.selectableWarehouses(all, 'r1').map((w) => w.id), ['a', 'b']);
  assert.deepEqual(model.keepSelectable(['a', 'c'], model.selectableWarehouses(all, 'r1')), ['a']);
  assert.equal(model.MAX_WAREHOUSES, 50);
  assert.deepEqual(model.toReportParams({ fromDate: '2026-11-01', toDate: '2026-11-20', regionId: '', top: 10, warehouseIds: ['a', 'b'] }),
    { fromDate: '2026-11-01', toDate: '2026-11-20', top: 10, warehouseIds: 'a,b' });
  const page = read('features/warehouse-report/WarehouseReportPage.tsx');
  assert.ok(page.includes('enabled: !invalid && !!user && picked.length > 0'));
  assert.ok(page.includes('Chọn kho ngay'));
});
