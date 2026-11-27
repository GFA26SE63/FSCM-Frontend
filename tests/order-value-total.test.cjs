const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Load the TS module with its two imports stubbed (no network, no app runtime).
const src = fs.readFileSync(path.join(__dirname, '..', 'src/features/reports/orderValueTotal.ts'), 'utf8')
  .replace(/^import .*$/gm, '');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const m = { exports: {} };
new Function('module', 'exports', 'graphql', js)(m, m.exports, async () => { throw new Error('live graphql must not be used'); });
const ov = m.exports;

const F = { from: '2026-03-01', to: '2026-03-31', retailerId: '', warehouseId: '' };

/** Fake server: payments (ledger) + orders. Honors deliveredDate range, status Paid, paging, id-in. */
function server({ payments, orders, pageSize = ov.ORDER_VALUE_PAGE_SIZE, mutate } = {}) {
  const calls = [];
  const run = async (query, vars = {}) => {
    calls.push(query);
    if (query.includes('payments(')) {
      const gte = /deliveredDate: \{ gte: "([^"]+)"/.exec(query)[1];
      const lte = /deliveredDate: \{ lte: "([^"]+)"/.exec(query)[1];
      assert.ok(/status: \{ eq: "Paid" \}/.test(query));
      const rows = payments.filter(p => p.status === 'Paid' && p.deliveredDate && p.deliveredDate >= gte && p.deliveredDate <= lte)
        .sort((a, b) => a.id.localeCompare(b.id));
      const start = vars.after ? Number(vars.after) : 0;
      const slice = rows.slice(start, start + pageSize);
      const end = start + slice.length;
      const page = { totalCount: rows.length, pageInfo: { hasNextPage: end < rows.length, endCursor: String(end) }, nodes: slice };
      return { entities: { page: mutate ? mutate(page, start) : page } };
    }
    return { entities: { page: { nodes: orders.filter(o => vars.ids.includes(o.id)) } } };
  };
  return { run, calls };
}
const pay = (id, so, amt, date, status = 'Paid') => ({ id, salesOrderId: so, adjustedAmount: amt, deliveredDate: date, status });
const ord = (id, status = 'Delivered', retailerId = 'r1') => ({ id, status, retailerId });
const total = async (s, f = F) => ov.fetchOrderValueTotal(f, s.run);

test('1 prepaid paid + delivered counted', async () => {
  const s = server({ payments: [pay('p1', 'o1', 1000000, '2026-03-10')], orders: [ord('o1')] });
  assert.deepEqual(await total(s), { status: 'ok', orderCount: 1, amountMinor: 100000000 });
});
test('2 not delivered (no deliveredDate) excluded', async () => {
  const s = server({ payments: [pay('p1', 'o1', 500, null)], orders: [ord('o1', 'Picking')] });
  assert.equal((await total(s)).amountMinor, 0);
});
test('3 pending/unpaid/partial/overdue payment excluded', async () => {
  const s = server({
    payments: ['Unpaid', 'PartiallyPaid', 'Overdue', 'Cancelled'].map((st, i) => pay(`p${i}`, `o${i}`, 100, '2026-03-05', st)),
    orders: [0, 1, 2, 3].map(i => ord(`o${i}`)),
  });
  assert.equal((await total(s)).amountMinor, 0);
});
test('4-6 credit unpaid / partial / approved-not-collected excluded; fully Paid included', async () => {
  const s = server({
    payments: [pay('a', 'o1', 100, '2026-03-05', 'Unpaid'), pay('b', 'o2', 100, '2026-03-05', 'PartiallyPaid'), pay('c', 'o3', 250, '2026-03-05', 'Paid')],
    orders: [ord('o1', 'Completed'), ord('o2', 'Completed'), ord('o3', 'Completed')],
  });
  assert.deepEqual(await total(s), { status: 'ok', orderCount: 1, amountMinor: 25000 });
});
test('7 multiple receivables: only the single settled ledger counts, once', async () => {
  const s = server({ payments: [pay('a', 'o1', 100, '2026-03-05'), pay('b', 'o1', 100, '2026-03-05')], orders: [ord('o1')] });
  assert.deepEqual(await total(s), { status: 'ok', orderCount: 1, amountMinor: 10000 });
});
test('7b same order with conflicting ledgers is incomplete', async () => {
  const s = server({ payments: [pay('a', 'o1', 100, '2026-03-05'), pay('b', 'o1', 200, '2026-03-05')], orders: [ord('o1')] });
  assert.equal((await total(s)).status, 'incomplete');
});
test('8 reversal after settlement: Backend status no longer Paid -> excluded', async () => {
  const s = server({ payments: [pay('a', 'o1', 100, '2026-03-05', 'PartiallyPaid')], orders: [ord('o1')] });
  assert.equal((await total(s)).amountMinor, 0);
});
test('9 approved adjustment: adjustedAmount (not original) is the amount', async () => {
  const s = server({ payments: [pay('a', 'o1', 900000, '2026-03-05')], orders: [ord('o1')] });
  assert.equal((await total(s)).amountMinor, 90000000);
  assert.ok(!/finalAmount/.test(s.calls.join('')));
});
test('10 multi-shipment order is one payment, counted once', async () => {
  const s = server({ payments: [pay('a', 'o1', 100, '2026-03-05')], orders: [ord('o1')] });
  assert.equal((await total(s)).orderCount, 1);
});
test('11 period uses deliveredDate; query never touches createdAt/paidDate/dueDate', async () => {
  const s = server({ payments: [pay('a', 'o1', 100, '2026-04-02')], orders: [ord('o1')] });
  assert.equal((await total(s)).amountMinor, 0);
  assert.ok(!/createdAt|paidDate|dueDate|finalApprovedAt/.test(s.calls[0]));
});
test('12 payment in a later month still reported under delivery month', async () => {
  const s = server({ payments: [pay('a', 'o1', 100, '2026-03-31')], orders: [ord('o1')] });
  assert.equal((await total(s)).amountMinor, 10000);
});
test('13 VN date boundaries inclusive on both ends, outside excluded', async () => {
  const s = server({
    payments: [pay('a', 'o1', 1, '2026-03-01'), pay('b', 'o2', 2, '2026-03-31'), pay('c', 'o3', 4, '2026-02-28'), pay('d', 'o4', 8, '2026-04-01')],
    orders: ['o1', 'o2', 'o3', 'o4'].map(i => ord(i)),
  });
  assert.equal((await total(s)).amountMinor, 300);
  assert.match(s.calls[0], /gte: "2026-03-01"/);
  assert.match(s.calls[0], /lte: "2026-03-31"/);
});
test('13b malformed date is rejected (no injection into query)', () => {
  assert.throws(() => ov.buildPaidDeliveredPaymentsQuery({ ...F, from: '2026-03-01" } }' }), /Ngày/);
});
test('14 multi-page read sums every page', async () => {
  const n = 450;
  const payments = Array.from({ length: n }, (_, i) => pay(`p${String(i).padStart(4, '0')}`, `o${i}`, 100, '2026-03-10'));
  const s = server({ payments, orders: payments.map(p => ord(p.salesOrderId)) });
  assert.deepEqual(await total(s), { status: 'ok', orderCount: n, amountMinor: n * 10000 });
});
test('15 duplicate rows across pages deduped; count mismatch -> incomplete', async () => {
  const payments = Array.from({ length: 3 }, (_, i) => pay(`p${i}`, `o${i}`, 100, '2026-03-10'));
  const s = server({ payments, orders: payments.map(p => ord(p.salesOrderId)), mutate: page => ({ ...page, nodes: [...page.nodes, page.nodes[0]] }) });
  // loaded (4) != totalCount (3)
  assert.equal((await total(s)).status, 'incomplete');
});
test('16 missing amount / missing order -> incomplete, never zero', async () => {
  assert.equal((await total(server({ payments: [pay('a', 'o1', null, '2026-03-10')], orders: [ord('o1')] }))).status, 'incomplete');
  assert.equal((await total(server({ payments: [pay('a', 'o1', 100, '2026-03-10')], orders: [] }))).status, 'incomplete');
});
test('17 warehouse filter: unsupported, no request', async () => {
  const s = server({ payments: [], orders: [] });
  assert.deepEqual(await total(s, { ...F, warehouseId: 'w1' }), { status: 'warehouse-unsupported' });
  assert.equal(s.calls.length, 0);
});
test('18 retailer filter applied through the order, cancelled/other statuses excluded', async () => {
  const s = server({
    payments: [pay('a', 'o1', 100, '2026-03-10'), pay('b', 'o2', 200, '2026-03-10'), pay('c', 'o3', 400, '2026-03-10')],
    orders: [ord('o1', 'Delivered', 'r1'), ord('o2', 'Delivered', 'r2'), ord('o3', 'Withdrawn', 'r1')],
  });
  assert.deepEqual(await total(s, { ...F, retailerId: 'r1' }), { status: 'ok', orderCount: 1, amountMinor: 10000 });
  assert.equal((await total(s)).amountMinor, 30000);
});
test('19 too large -> unavailable, count drift -> incomplete, error propagates', async () => {
  const payments = Array.from({ length: 5 }, (_, i) => pay(`p${i}`, `o${i}`, 1, '2026-03-10'));
  const s = server({ payments, orders: [] });
  assert.equal((await ov.fetchOrderValueTotal(F, s.run, 3)).status, 'too-large');
  const drift = server({ payments, orders: payments.map(p => ord(p.salesOrderId)), pageSize: 2, mutate: (p, start) => ({ ...p, totalCount: p.totalCount + start }) });
  assert.equal((await total(drift)).status, 'incomplete');
  await assert.rejects(ov.fetchOrderValueTotal(F, async () => { throw new Error('boom'); }), /boom/);
});
test('20 no write-off valuation in this module; page keeps write-off value unavailable', () => {
  assert.ok(!/writeOff/i.test(src));
  const page = fs.readFileSync(path.join(__dirname, '..', 'src/features/reports/FinancialReportsPage.tsx'), 'utf8');
  assert.ok(page.includes('writeOffValueText'));
});
test('minor-unit arithmetic exact and formatted', () => {
  assert.equal(ov.formatMinorVnd(350010050), '3.500.100,50 VND');
  assert.equal(ov.toMinor(0.1) + ov.toMinor(0.2), 30);
});
