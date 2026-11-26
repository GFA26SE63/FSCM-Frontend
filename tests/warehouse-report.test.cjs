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
// The model only has a type import from '@/shared/lib/excel', which transpiling removes.
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
  assert.match(routes, /key: 'warehouse-report', label: 'Báo cáo kho vận', roles: \[A, OP, WK\]/);
  assert.match(read('app/layout/Sidebar.tsx'), /key: 'overview'.*'warehouse-report'/);
  const page = read('features/warehouse-report/WarehouseReportPage.tsx');
  assert.ok(page.includes("'/reports/warehouse-logistics'"));
  assert.ok(page.includes('<Modal'));
  assert.ok(page.includes('tài xế') && page.includes(' xe</Chip>'));
});

const stock = (over) => ({ productId: over.sku, sku: 'S', name: 'N', rank: 1, onHand: 0, valid: 0, nearExpiry: 0,
  expired: 0, locked: 0, disposed: 0, factoryReceipt: 0, transferReceipt: 0, salesIssue: 0, transferIssue: 0, ...over });

test('warehouse report: metric headers sort nhiều nhất → ít nhất → back to rank, ties by rank', () => {
  let s = model.nextSort(null, 'valid');
  assert.deepEqual(s, { key: 'valid', dir: 'desc' });
  s = model.nextSort(s, 'valid');
  assert.deepEqual(s, { key: 'valid', dir: 'asc' });
  assert.equal(model.nextSort(s, 'valid'), null);
  assert.deepEqual(model.nextSort(s, 'salesIssue'), { key: 'salesIssue', dir: 'desc' });
  const rows = [stock({ sku: 'A', rank: 1, valid: 5 }), stock({ sku: 'B', rank: 2, valid: 9 }), stock({ sku: 'C', rank: 3, valid: 5 })];
  assert.deepEqual(model.sortProducts(rows, { key: 'valid', dir: 'desc' }).map((p) => p.sku), ['B', 'A', 'C']);
  assert.deepEqual(model.sortProducts(rows, { key: 'valid', dir: 'asc' }).map((p) => p.sku), ['A', 'C', 'B']);
  assert.deepEqual(model.sortProducts([...rows].reverse(), null).map((p) => p.sku), ['A', 'B', 'C']);
  const page = read('features/warehouse-report/WarehouseReportPage.tsx');
  assert.ok(page.includes('className={`wr-sort') && page.includes('aria-sort='));
});

test('warehouse report: Excel has a per-warehouse sheet with Tổng rows and colours, plus a flat sheet', async () => {
  const ExcelJS = require('exceljs');
  const excelSrc = path.resolve(__dirname, '../src/shared/lib/excel.ts');
  const excel = { exports: {} };
  new Function('require', 'exports', ts.transpileModule(fs.readFileSync(excelSrc, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText)(require, excel.exports);
  const w = (code, products) => ({ id: code, code, name: `Kho ${code}`, regionId: 'r', regionName: 'Miền Nam',
    driverCount: 2, vehicleCount: 3, products });
  const report = { fromDate: '2026-11-01', toDate: '2026-11-20', regionId: null, top: 10, topProducts: [],
    warehouses: [w('W1', [stock({ sku: 'MILK', name: 'Sữa', rank: 1, valid: 4, salesIssue: 7 }), stock({ sku: 'YOG', rank: 2, valid: 9 })]), w('W2', [])] };
  const sheets = model.warehouseReportSheets(report, { sort: { key: 'valid', dir: 'desc' }, exportedAt: '20/11/2026 10:00' });
  assert.deepEqual(sheets.map((s) => s.name), ['Theo kho', 'Dữ liệu chi tiết']);
  const [byWarehouse, flat] = sheets;
  assert.equal(byWarehouse.blocks.length, 2);
  assert.match(byWarehouse.blocks[0].title, /W1 · Kho W1 · Miền Nam · 2 tài xế · 3 xe/);
  assert.deepEqual(byWarehouse.blocks[0].rows.map((r) => r[1]), ['YOG', 'MILK'], 'Excel follows the on-screen sort');
  assert.equal(byWarehouse.blocks[0].totals[1], 'Tổng');
  assert.equal(byWarehouse.blocks[0].totals[3], 13);
  assert.equal(flat.blocks[0].rows.length, 2);
  assert.match(byWarehouse.info[0], /01\/11\/2026 – 20\/11\/2026/);

  const wb = excel.exports.buildWorkbook(new ExcelJS.Workbook(), sheets);
  const ws = wb.getWorksheet('Theo kho');
  const values = [];
  ws.eachRow((row) => values.push(row.values.slice(1)));
  const totalsRow = values.findIndex((v) => v.includes('Tổng'));
  assert.ok(totalsRow > 0);
  const milkRow = ws.getRow(values.findIndex((v) => v.includes('MILK')) + 1);
  assert.equal(milkRow.getCell(4).fill.fgColor.argb, model.EXCEL_TONES.valid.fill);
  assert.ok((await wb.xlsx.writeBuffer()).byteLength > 1000);
});

test('warehouse report: chart + comparison matrix + transfer suggestion helpers work', () => {
  const report = {
    fromDate: '2026-11-01',
    toDate: '2026-11-26',
    regionId: null,
    top: 10,
    topProducts: [],
    warehouses: [
      {
        id: 'w1',
        code: 'WH-TD',
        name: 'Kho Thủ Đức',
        regionId: 'r1',
        regionName: 'TP.HCM',
        driverCount: 3,
        vehicleCount: 3,
        products: [stock({ productId: 'p1', sku: 'SKU001', name: 'Sữa chua', rank: 1, valid: 98, nearExpiry: 5, salesIssue: 10 })],
      },
      {
        id: 'w2',
        code: 'WH-Q7',
        name: 'Kho Quận 7',
        regionId: 'r1',
        regionName: 'TP.HCM',
        driverCount: 2,
        vehicleCount: 2,
        products: [stock({ productId: 'p1', sku: 'SKU001', name: 'Sữa chua', rank: 1, valid: 8, salesIssue: 60 })],
      },
    ],
  };

  const chart = model.buildWarehouseChartData(report);
  assert.equal(chart.length, 2);
  assert.equal(chart[0].code, 'WH-TD');
  assert.equal(chart[0].valid, 98);
  assert.equal(chart[1].salesIssue, 60);

  const comparisons = model.buildSkuComparisons(report);
  assert.equal(comparisons.length, 1);
  assert.equal(comparisons[0].highestStock.code, 'WH-TD');
  assert.equal(comparisons[0].topSales.code, 'WH-Q7');
  assert.equal(comparisons[0].transferSuggestion.fromCode, 'WH-TD');
  assert.equal(comparisons[0].transferSuggestion.toCode, 'WH-Q7');

  const page = read('features/warehouse-report/WarehouseReportPage.tsx');
  assert.ok(page.includes('BarChart'));
  assert.ok(page.includes('/warehouse-transfers/new'));
});
