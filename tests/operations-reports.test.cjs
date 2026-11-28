const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../src/features/reports/reportExport.ts');
const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const loaded = { exports: {} };
new Function('exports', code)(loaded.exports);
const { loadAllReportRows } = loaded.exports;

const ExcelJS = require('exceljs');
const excelFile = path.resolve(__dirname, '../src/shared/lib/excel.ts');
const excel = { exports: {} };
new Function('require', 'exports', ts.transpileModule(fs.readFileSync(excelFile, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(require, excel.exports);

const layoutFile = path.resolve(__dirname, '../src/features/reports/reportLayout.ts');
const layoutCode = ts.transpileModule(fs.readFileSync(layoutFile, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const layout = { exports: {} };
new Function('exports', layoutCode)(layout.exports);
const { summaryColumns, REPORT_TITLES, normalizeReportKind, canAccessReport } = layout.exports;

test('report Excel keeps Vietnamese text, numbers as numbers, formulas as plain text, styled header', async () => {
  const wb = excel.exports.buildWorkbook(new ExcelJS.Workbook(), [{
    name: 'Báo cáo: đổi/quà?', title: 'Báo cáo đổi quà', info: ['Khoảng thời gian: 01/11/2026 – 20/11/2026'],
    blocks: [{ columns: [{ header: 'Nhà bán lẻ' }, { header: 'Điểm', numeric: true }],
      rows: [['Quà "Tết", giao\nđợt 2', 1200], ['=HYPERLINK("x")', null]] }],
  }]);
  const ws = wb.worksheets[0];
  assert.equal(ws.name, 'Báo cáo  đổi quà');
  assert.equal(ws.getCell('A5').value, 'Quà "Tết", giao\nđợt 2');
  assert.equal(ws.getCell('B5').value, 1200);
  assert.equal(ws.getCell('A6').value, '=HYPERLINK("x")');
  assert.equal(ws.getCell('A6').type, ExcelJS.ValueType.String);
  const buffer = await wb.xlsx.writeBuffer();
  assert.ok(buffer.byteLength > 1000);
});

test('all overhauled report views export Excel (.xlsx) instead of CSV', () => {
  const views = [
    'FinancialReportView.tsx', 'ReceivablesReportView.tsx', 'PromotionsReportView.tsx',
    'LoyaltyReportView.tsx', 'ClaimsReportView.tsx', 'FulfillmentReportView.tsx', 'InventoryRiskReportView.tsx',
  ];
  for (const v of views) {
    const src = fs.readFileSync(path.resolve(__dirname, '../src/features/reports', v), 'utf8');
    assert.ok(src.includes('Xuất Excel'), `${v} must include Xuất Excel`);
    assert.ok(src.includes('downloadExcel(') && src.includes('.xlsx'), `${v} must download .xlsx`);
  }
});

test('report export collects all filtered records across pages and refuses inconsistent updates', async () => {
  const requested = [];
  const rows = await loadAllReportRows(async (page, size) => {
    requested.push([page, size]);
    return { totalCount: 201, items: Array.from({ length: page === 1 ? 200 : 1 }, (_, i) => ({ id: String((page - 1) * size + i) })) };
  });
  assert.equal(rows.length, 201);
  assert.deepEqual(requested, [[1, 200], [2, 200]]);
  await assert.rejects(loadAllReportRows(async page => page === 1 ? { totalCount: 2, items: [{ id: 'a' }] } : { totalCount: 3, items: [{ id: 'b' }] }, 1), /Dữ liệu thay đổi/);
});

test('report architecture defines 7 cohesive kinds, normalizes legacy aliases, and guards role access', () => {
  assert.equal(summaryColumns(6), 6);
  assert.equal(summaryColumns(7), 4);
  assert.equal(summaryColumns(0), 1);
  assert.deepEqual(Object.keys(REPORT_TITLES), ['financial', 'receivables', 'promotions', 'loyalty', 'claims', 'fulfillment', 'inventory-risk']);

  assert.deepEqual(normalizeReportKind('redemptions', 'Admin'), { kind: 'loyalty', defaultTab: 'redemptions' });
  assert.deepEqual(normalizeReportKind('disposals', 'WarehouseKeeper'), { kind: 'inventory-risk', defaultTab: 'disposals' });
  assert.deepEqual(normalizeReportKind(null, 'WarehouseKeeper'), { kind: 'inventory-risk' });
  assert.deepEqual(normalizeReportKind(null, 'SalesManager'), { kind: 'financial' });

  assert.equal(canAccessReport('inventory-risk', 'WarehouseKeeper'), true);
  assert.equal(canAccessReport('fulfillment', 'WarehouseKeeper'), true);
  assert.equal(canAccessReport('financial', 'WarehouseKeeper'), false);
  assert.equal(canAccessReport('inventory-risk', 'SalesManager'), false);
  assert.equal(canAccessReport('fulfillment', 'SalesManager'), true);
});
