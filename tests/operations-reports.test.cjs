const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/features/reports/reportCsv.ts');
const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const loaded = { exports: {} };
new Function('exports', code)(loaded.exports);
const { csvCell, loadAllReportRows } = loaded.exports;

test('report CSV preserves Vietnamese, quotes and multiline notes while neutralizing formulas', () => {
  assert.equal(csvCell('Quà "Tết", giao\nđợt 2'), '"Quà ""Tết"", giao\nđợt 2"');
  for (const input of ['=HYPERLINK("x")', '+1', '-1', '@SUM(1)', ' \t=1'])
    assert.equal(csvCell(input).startsWith('"\''), true);
  assert.equal(csvCell('Nguyễn Văn An'), '"Nguyễn Văn An"');
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
