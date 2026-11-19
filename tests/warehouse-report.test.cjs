const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function source(file) {
  const filename = path.resolve(__dirname, '../src', file);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(require, module, module.exports);
  return module.exports;
}
const read = (file) => fs.readFileSync(path.resolve(__dirname, '../src', file), 'utf8');
const model = source('features/warehouse-report/warehouseReportModel.ts');

test('warehouse report: default top is 10, user choices are clamped to 1..50', () => {
  assert.equal(model.DEFAULT_TOP, 10);
  assert.ok(model.TOP_OPTIONS.includes(10));
  assert.equal(model.clampTop(0), 1);
  assert.equal(model.clampTop(80), 50);
  assert.equal(model.clampTop(Number.NaN), 10);
});

test('warehouse report: query params carry period, top and only a chosen region', () => {
  assert.deepEqual(model.toReportParams({ fromDate: '2026-11-01', toDate: '2026-11-20', regionId: '', top: 10 }),
    { fromDate: '2026-11-01', toDate: '2026-11-20', top: 10 });
  assert.deepEqual(model.toReportParams({ fromDate: '2026-11-01', toDate: '2026-11-20', regionId: 'r1', top: 20 }),
    { fromDate: '2026-11-01', toDate: '2026-11-20', top: 20, regionId: 'r1' });
});

test('warehouse report: period validation matches the 367-day backend limit', () => {
  assert.equal(model.rangeError('2026-11-01', '2026-11-20'), null);
  assert.match(model.rangeError('2026-11-20', '2026-11-01'), /Đến ngày/);
  assert.match(model.rangeError('2025-01-01', '2026-11-01'), /367/);
  assert.match(model.rangeError('', '2026-11-01'), /Từ ngày/);
});

test('warehouse report: stock, inbound and outbound metrics each have their own colour', () => {
  const keys = model.METRICS.map((m) => m.key);
  assert.deepEqual(keys, ['valid', 'nearExpiry', 'expired', 'locked', 'disposed',
    'factoryReceipt', 'transferReceipt', 'salesIssue', 'transferIssue']);
  assert.equal(new Set(model.METRICS.map((m) => m.tone)).size, model.METRICS.length);
  // The 5 stock columns are current warehouse state; only inbound/outbound follow the date filter.
  assert.deepEqual(model.METRICS.filter((m) => m.group === 'stock').map((m) => m.key),
    ['valid', 'nearExpiry', 'expired', 'locked', 'disposed']);
  assert.equal(model.GROUP_LABELS.stock, 'Tồn kho hiện tại');
  assert.match(model.METRICS.find((m) => m.key === 'disposed').hint, /không theo khoảng thời gian/);
  const css = read('features/warehouse-report/warehouseReport.css');
  for (const m of model.METRICS) assert.ok(css.includes(`.wr-${m.tone} {`), `missing colour for ${m.key}`);
});

test('warehouse report: totals and summary add up per warehouse', () => {
  const product = (over) => ({ productId: 'p', sku: 'S', name: 'N', rank: 1, onHand: 0, valid: 0, nearExpiry: 0,
    expired: 0, locked: 0, disposed: 0, factoryReceipt: 0, transferReceipt: 0, salesIssue: 0, transferIssue: 0, ...over });
  const w = { id: 'w', code: 'W', name: 'Kho', regionId: 'r', regionName: 'R', driverCount: 2, vehicleCount: 3,
    products: [product({ valid: 5, salesIssue: 4 }), product({ valid: 1, locked: 2, factoryReceipt: 9 })] };
  const totals = model.warehouseTotals(w);
  assert.equal(totals.valid, 6);
  assert.equal(totals.locked, 2);
  assert.equal(totals.salesIssue, 4);
  assert.equal(totals.factoryReceipt, 9);
  assert.deepEqual(model.reportSummary({ top: 10, topProducts: [{}, {}], warehouses: [w, { ...w, driverCount: 1, vehicleCount: 0 }] }),
    { warehouses: 2, drivers: 3, vehicles: 3, products: 2 });
});

test('warehouse report: page sits in the "Tổng quan" sidebar group, Admin/Operator only, details in a popup', () => {
  const routes = read('app/routes.tsx');
  assert.match(routes, /key: 'warehouse-report', label: 'Báo cáo kho vận', roles: \[A, OP\]/);
  assert.match(read('app/layout/Sidebar.tsx'), /key: 'overview'.*'warehouse-report'/);
  const page = read('features/warehouse-report/WarehouseReportPage.tsx');
  assert.ok(page.includes("'/reports/warehouse-logistics'"));
  assert.ok(page.includes('<Modal'));
  assert.ok(page.includes('tài xế') && page.includes(' xe</Chip>'));
});

test('warehouse report: "Chi tiết" leads each SKU row, totals row says "Tổng", table never scrolls sideways', () => {
  const page = read('features/warehouse-report/WarehouseReportPage.tsx');
  const row = page.slice(page.indexOf('<tbody>'), page.indexOf('</tbody>'));
  assert.ok(row.indexOf('Chi tiết') < row.indexOf('p.rank'), 'Chi tiết must be the first cell');
  assert.ok(page.includes('<td className="bold">Tổng</td>'));
  assert.ok(!page.includes('Cộng {'));
  assert.ok(!page.includes('SimpleTable'), 'SimpleTable sets a min-width that forces horizontal scroll');
  const css = read('features/warehouse-report/warehouseReport.css');
  assert.match(css, /\.wr-grid \{\s*width: 100%;\s*table-layout: fixed;/);
  assert.equal(new Set(model.METRICS.map((m) => m.short)).size >= 8, true);
});
