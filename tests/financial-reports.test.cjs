const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const read = (f) => fs.readFileSync(path.resolve(__dirname, '../src', f), 'utf8');
function load(file, mocks = {}) {
  const code = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)((n) => (n in mocks ? mocks[n] : require(n)), module, module.exports);
  return module.exports;
}
const g = load('features/reports/financialGraphql.ts', { '@/shared/api/graphql': { graphql: async () => ({}) } });
const f = { from: '2026-11-01', to: '2026-11-30', retailerId: '', warehouseId: '' };

test('date range uses Vietnam midnight, inclusive end via exclusive next day (no off-by-one)', () => {
  assert.deepEqual(g.dateRange('2026-11-01', '2026-11-30'), { from: '2026-11-01T00:00:00+07:00', toExclusive: '2026-12-01T00:00:00+07:00' });
  assert.equal(g.dateRange('2026-12-31', '2026-12-31').toExclusive, '2027-01-01T00:00:00+07:00');
  assert.equal(g.dateRange('2028-02-28', '2028-02-28').toExclusive, '2028-02-29T00:00:00+07:00');
});

test('orders query: filters by IDs, server-side count, no aggregation fields', () => {
  const none = g.buildOrdersQuery(f);
  assert.ok(!none.query.includes('retailerId: { eq'));
  const withR = g.buildOrdersQuery({ ...f, retailerId: 'r-1', warehouseId: 'w-1' });
  assert.match(withR.query, /retailerId: \{ eq: \$retailerId \}/);
  assert.equal(withR.variables.retailerId, 'r-1');
  assert.ok(!withR.query.includes('warehouseId')); // warehouse is not an order filter
  assert.match(withR.query, /totalCount/);
  assert.match(withR.query, /finalAmount/);
  assert.ok(!/sum|aggregate/i.test(withR.query));
});

test('write-off query: warehouse filter by ID, no retailer, no invented valuation fields', () => {
  const q = g.buildWriteOffsQuery({ ...f, retailerId: 'r-1', warehouseId: 'w-1' }, 'cur');
  assert.match(q.query, /warehouseId: \{ eq: \$warehouseId \}/);
  assert.ok(!q.query.includes('retailerId'));
  assert.ok(!/cost|price|value|amount/i.test(q.query));
  assert.equal(q.variables.after, 'cur');
});

test('page: standalone filter card, no fabricated money totals, route under existing reports screen', () => {
  const page = read('features/reports/FinancialReportsPage.tsx');
  assert.match(page, /<PageHeader title="Báo cáo tài chính"/);
  assert.match(page, /className="card report-filters"/); // same filter block as the promotions report
  assert.ok(page.indexOf('card report-filters') < page.indexOf('role="tablist"'));
  assert.match(page, />Đơn hàng<\/Button>/);
  assert.match(page, />Hàng hủy<\/Button>/);
  assert.ok(page.includes('navigate(`/orders/${o.id}`)'));
  assert.ok(page.includes('navigate(`/disposal/${w.writeOffCode}`)'));
  assert.match(page, /<DataTable<T>/); // shared table
  assert.match(page, /useCursorPagination/); // shared pagination
  assert.match(page, /excelFileName=\{null\}/); // no page-only export
  assert.match(page, /fetchOrderValueTotal/);
  assert.ok(!/Chưa có dữ liệu tổng hợp/.test(page));
  assert.ok(page.includes('writeOffValueText')); // value comes from fetchWriteOffValueTotal, not row sums
  assert.ok(!/reduce\(/.test(page)); // no client-side summing of rows
  assert.match(read('app/routes.tsx'), /report-financial[^\n]*kind=financial/);
  assert.match(read('features/reports/OperationsReportsPage.tsx'), /requested === 'financial'/);
});

test('paging args: backward and page-size variants are server-side cursor queries', () => {
  const back = g.buildOrdersQuery(f, undefined, { before: 'b1', size: 20 });
  assert.match(back.query, /last: 20, before: \$before/);
  assert.equal(back.variables.before, 'b1');
  const fwd = g.buildWriteOffsQuery(f, 'a1', { size: 50 });
  assert.match(fwd.query, /first: 50, after: \$after/);
});
