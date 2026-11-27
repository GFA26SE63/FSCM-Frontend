const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(mockGraphql) {
  const file = path.resolve(__dirname, '../src/features/orders/orderCartons.ts');
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'exports', 'module', code)(() => ({ graphql: mockGraphql }), mod.exports, mod);
  return mod.exports;
}
const orderId = '11111111-1111-1111-1111-111111111111';
const page = (field, nodes, hasNextPage = false, endCursor = null) => ({
  entities: { [field]: { nodes, pageInfo: { hasNextPage, endCursor } } },
});

test('cartons use order-scoped issue lines, excluding picking copies and unrelated lines', async () => {
  const calls = [];
  const api = load(async (query, variables) => {
    calls.push({ query, variables });
    if (query.includes('warehouseDocumentLines(')) return page('warehouseDocumentLines', [
      { id: 'picking-line', documentId: 'picking', sku: 'A', productName: 'Product A' },
      { id: 'issue-line', documentId: 'issue', sku: 'A', productName: 'Product A' },
    ]);
    if (query.includes('warehouseDocuments(')) return page('warehouseDocuments', [{ id: 'issue', code: 'PXK-1', warehouseId: 'WH-1' }]);
    return page('warehouseDocumentCartons', [{ id: 'c', documentId: 'issue', lineId: 'issue-line', cartonId: 'CID-1', scannedAt: null }]);
  });
  const rows = await api.fetchOrderCartons(orderId);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].warehouseId, 'WH-1');
  assert.equal(rows[0].sku, 'A');
  assert.match(calls[0].query, new RegExp(`salesOrderId: \\{ eq: "${orderId}"`));
  assert.match(calls[1].query, /kind: \{ eq: "Issue" \}/);
  assert.match(calls[1].query, /status: \{ neq: "Cancelled" \}/);
  assert.match(calls[2].query, /lineId: \{ in: \["issue-line"\]/);
  assert.doesNotMatch(calls[2].query, /picking-line/);
});

test('all carton pages are loaded and sorted', async () => {
  const api = load(async (query, variables) => {
    if (query.includes('warehouseDocumentLines(')) return page('warehouseDocumentLines', [{ id: 'l', documentId: 'd', sku: 'A', productName: 'A' }]);
    if (query.includes('warehouseDocuments(')) return page('warehouseDocuments', [{ id: 'd', code: 'PXK', warehouseId: 'w' }]);
    const carton = { documentId: 'd', lineId: 'l', scannedAt: null };
    return variables.after === null
      ? page('warehouseDocumentCartons', [{ ...carton, id: 'c2', cartonId: 'CID-2' }], true, 'next')
      : page('warehouseDocumentCartons', [{ ...carton, id: 'c1', cartonId: 'CID-1' }]);
  });
  assert.deepEqual((await api.fetchOrderCartons(orderId)).map(row => row.cartonId), ['CID-1', 'CID-2']);
});

test('empty order stops before querying documents and cartons', async () => {
  let count = 0;
  const api = load(async () => { count++; return page('warehouseDocumentLines', []); });
  assert.deepEqual(await api.fetchOrderCartons(orderId), []);
  assert.equal(count, 1);
});

test('provider failures and broken cursors are surfaced instead of partial results', async () => {
  const denied = load(async () => { throw new Error('Forbidden'); });
  await assert.rejects(denied.fetchOrderCartons(orderId), /Forbidden/);
  const repeated = load(async () => page('warehouseDocumentLines', [], true, 'same'));
  await assert.rejects(repeated.fetchOrderCartons(orderId), /Phân trang/);
  const invalid = load(async () => ({ entities: {} }));
  await assert.rejects(invalid.fetchOrderCartons(orderId), /Không tải/);
});

test('invalid order identity never reaches the backend', async () => {
  const api = load(async () => assert.fail('must not request'));
  await assert.rejects(api.fetchOrderCartons('invalid'), /không hợp lệ/);
});
