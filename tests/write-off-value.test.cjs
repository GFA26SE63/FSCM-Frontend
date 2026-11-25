const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const toMinorSrc = ts.transpileModule(read('src/features/reports/orderValueTotal.ts').replace(/^import .*$/gm, ''), { compilerOptions: { module: 1, target: 9 } }).outputText;
const tm = { exports: {} };
new Function('module', 'exports', 'graphql', toMinorSrc)(tm, tm.exports, null);
const src = read('src/features/reports/writeOffValueTotal.ts').replace(/^import .*$/gm, '');
const js = ts.transpileModule(src, { compilerOptions: { module: 1, target: 9 } }).outputText;
const m = { exports: {} };
new Function('module', 'exports', 'graphql', 'dateRange', 'toMinor', js)(m, m.exports, null,
  (from, to) => ({ from: `${from}T00:00:00+07:00`, toExclusive: `${to}x` }), tm.exports.toMinor);
const w = m.exports;
const F = { from: '2026-03-01', to: '2026-03-31', retailerId: '', warehouseId: '' };

function server({ docs, items, batches, prices }) {
  return async (query, vars = {}) => {
    const wrap = nodes => ({ entities: { page: { totalCount: nodes.length, pageInfo: { hasNextPage: false, endCursor: null }, nodes } } });
    if (query.includes('writeOffs(')) return wrap(docs);
    if (query.includes('writeOffItems(')) return wrap(items.filter(i => vars.ids.includes(i.writeOffId)));
    if (query.includes('batches(')) return wrap(batches.filter(b => vars.ids.includes(b.id)));
    return wrap(prices.filter(p => vars.ids.includes(p.productId)));
  };
}
const base = () => ({
  docs: [{ id: 'd1', createdAt: '2026-03-10T03:00:00Z' }],
  items: [{ id: 'i1', writeOffId: 'd1', batchId: 'b1', quantity: 10 }],
  batches: [{ id: 'b1', productId: 'p1' }],
  prices: [
    { id: 'v1', productId: 'p1', unitPrice: 1000, effectiveFrom: '2026-01-01T00:00:00Z', effectiveTo: '2026-03-05T00:00:00Z' },
    { id: 'v2', productId: 'p1', unitPrice: 2000, effectiveFrom: '2026-03-05T00:00:00Z', effectiveTo: null },
  ],
});

test('uses the price version in force at write-off creation', async () => {
  assert.deepEqual(await w.fetchWriteOffValueTotal(F, server(base())), { status: 'ok', docCount: 1, amountMinor: 2000000 });
  const d = base(); d.docs[0].createdAt = '2026-02-01T00:00:00Z';
  assert.equal((await w.fetchWriteOffValueTotal(F, server(d))).amountMinor, 1000000);
});
test('later price change does not alter an older write-off', async () => {
  const d = base(); d.prices.push({ id: 'v3', productId: 'p1', unitPrice: 9999, effectiveFrom: '2026-04-01T00:00:00Z', effectiveTo: null });
  assert.equal((await w.fetchWriteOffValueTotal(F, server(d))).amountMinor, 2000000);
});
test('decimal quantity is exact', async () => {
  const d = base(); d.items[0].quantity = 2.5;
  assert.equal((await w.fetchWriteOffValueTotal(F, server(d))).amountMinor, 500000);
});
test('missing price/batch -> incomplete, never zero', async () => {
  const d = base(); d.prices = [];
  assert.equal((await w.fetchWriteOffValueTotal(F, server(d))).status, 'incomplete');
  const e = base(); e.batches = [];
  assert.equal((await w.fetchWriteOffValueTotal(F, server(e))).status, 'incomplete');
});
test('no write-offs -> 0 with ok; too many -> unavailable', async () => {
  assert.deepEqual(await w.fetchWriteOffValueTotal(F, server({ docs: [], items: [], batches: [], prices: [] })), { status: 'ok', docCount: 0, amountMinor: 0 });
  assert.equal((await w.fetchWriteOffValueTotal(F, server(base()), 0)).status, 'too-large');
});
test('reason JSON shows only the method; plain text kept', () => {
  const raw = JSON.stringify({ Method: 'Tiêu hủy tại kho', RequestHash: 'ABC', Operation: 'HUY-1' });
  assert.equal(w.writeOffReasonText(raw), 'Tiêu hủy tại kho');
  assert.equal(w.writeOffReasonText('Hàng hỏng'), 'Hàng hỏng');
  assert.equal(w.writeOffReasonText(null), '—');
});
test('page translates statuses through the shared map', () => {
  const page = read('src/features/reports/FinancialReportsPage.tsx');
  assert.match(page, /statusLabel\('order', o\.status\)/);
  assert.match(page, /statusLabel\('disposal', w\.status\)/);
  assert.ok(!/Chưa có dữ liệu định giá/.test(page));
});
