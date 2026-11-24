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
  assert.match(css, /\.pallet-receiving-history \{ margin-top: 28px; \}/);
  assert.match(css, /\.pallet-camera \{ margin-bottom: 16px; \}/);
});

test('receipt (PNK) list and detail no longer show an order count / order column', () => {
  const src = read('features/warehouse-work/index.tsx');
  const pnk = src.slice(src.indexOf("'Danh sách Phiếu Nhập Kho (PNK)'"), src.indexOf("'Danh sách Phiếu Xuất Luân Chuyển (PXK)'"));
  assert.ok(pnk.includes("header: 'Số thùng'"));
  assert.ok(!pnk.includes('đơn ·'));
  assert.ok(src.includes("...(d.kind === 'Receipt' ? [] : [{ header: 'Đơn hàng'"));
  // Issue (PXK) list still shows orders.
  const pxk = src.slice(src.indexOf("'Danh sách Phiếu Xuất Luân Chuyển (PXK)'"));
  assert.ok(pxk.includes("header: 'Đơn / thùng'"));
});

test('loyalty report has a totals row for "Biến động điểm" (received / used over the whole filter)', () => {
  const page = read('features/reports/OperationsReportsPage.tsx');
  assert.ok(page.includes("footer={kind === 'loyalty' && data.pointsTotal ? loyaltyFooter(tableCols, data.pointsTotal) : undefined}"));
  assert.ok(page.includes("'Tổng (toàn bộ bộ lọc)'"));
  assert.ok(page.includes('Nhận +{formatNumber(total.received)} · Dùng −{formatNumber(total.used)}'));
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
  assert.ok(page.includes('Chọn ít nhất một kho để xem báo cáo.'));
});
