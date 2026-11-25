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

test('report Excel keeps Vietnamese text, numbers as numbers, formulas as plain text, styled header', async () => {
  const wb = excel.exports.buildWorkbook(new ExcelJS.Workbook(), [{
    name: 'Báo cáo: đổi/quà?', title: 'Báo cáo đổi quà', info: ['Khoảng thời gian: 01/11/2026 – 20/11/2026'],
    blocks: [{ columns: [{ header: 'Nhà bán lẻ' }, { header: 'Điểm', numeric: true }],
      rows: [['Quà "Tết", giao\nđợt 2', 1200], ['=HYPERLINK("x")', null]] }],
  }]);
  const ws = wb.worksheets[0];
  assert.equal(ws.name, 'Báo cáo  đổi quà');
  assert.equal(ws.getCell('A1').value, 'Báo cáo đổi quà');
  const header = ws.getRow(4);
  assert.equal(header.getCell(1).value, 'Nhà bán lẻ');
  assert.equal(header.getCell(1).font.bold, true);
  assert.equal(header.getCell(1).fill.fgColor.argb, 'FF14655B');
  assert.equal(ws.getCell('A5').value, 'Quà "Tết", giao\nđợt 2');
  assert.equal(ws.getCell('B5').value, 1200);
  assert.equal(ws.getCell('B5').numFmt, '#,##0.##');
  // A string cell is never a formula cell.
  assert.equal(ws.getCell('A6').value, '=HYPERLINK("x")');
  assert.equal(ws.getCell('A6').type, ExcelJS.ValueType.String);
  assert.deepEqual(ws.autoFilter, { from: { row: 4, column: 1 }, to: { row: 4, column: 2 } });
  const buffer = await wb.xlsx.writeBuffer();
  assert.ok(buffer.byteLength > 1000);
});

test('operations reports export Excel instead of CSV', () => {
  const page = fs.readFileSync(path.resolve(__dirname, '../src/features/reports/OperationsReportsPage.tsx'), 'utf8');
  assert.ok(page.includes('Xuất Excel'));
  assert.ok(page.includes('downloadExcel(') && page.includes('.xlsx'));
  assert.ok(!/csv/i.test(page.replace(/reportExport/g, '')));
});

test('report export collects all filtered records across pages and handles empty results', async () => {
  const requested = [];
  const rows = await loadAllReportRows(async (page, size) => {
    requested.push([page, size]);
    return { totalCount: 201, items: Array.from({ length: page === 1 ? 200 : 1 }, (_, i) => ({ id: String((page - 1) * size + i) })) };
  });
  assert.equal(rows.length, 201);
  assert.equal(rows.at(-1).id, '200');
  assert.deepEqual(requested, [[1, 200], [2, 200]]);
  assert.deepEqual(await loadAllReportRows(async () => ({ totalCount: 0, items: [] })), []);
});

test('report export refuses duplicate or changed pages rather than downloading misleading totals', async () => {
  for (const second of [
    { totalCount: 2, items: [{ id: 'a' }] },
    { totalCount: 3, items: [{ id: 'b' }] },
    { totalCount: 2, items: [] },
  ]) {
    await assert.rejects(loadAllReportRows(async page => page === 1
      ? { totalCount: 2, items: [{ id: 'a' }] } : second), /Dữ liệu thay đổi/);
  }
});
test('report summary tiles fill one row, or two even rows when there are many', () => {
  const layoutFile = path.resolve(__dirname, '../src/features/reports/reportLayout.ts');
  const layoutCode = ts.transpileModule(fs.readFileSync(layoutFile, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const layout = { exports: {} };
  new Function('exports', layoutCode)(layout.exports);
  const { summaryColumns, REPORT_TITLES } = layout.exports;
  assert.equal(summaryColumns(6), 6);   // đổi quà: 1 hàng
  assert.equal(summaryColumns(7), 4);   // khuyến mãi: 4 + 3
  assert.equal(summaryColumns(11), 6);  // loyalty: 6 + 5
  assert.equal(summaryColumns(0), 1);
  assert.deepEqual(Object.keys(REPORT_TITLES), ['redemptions', 'loyalty', 'promotions', 'disposals', 'claims', 'receivables']);
});