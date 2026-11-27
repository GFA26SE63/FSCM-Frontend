const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const issueId = '11111111-1111-1111-1111-111111111111';
const page = (field, nodes, more = false, cursor = null) => ({ entities: { [field]: { nodes, pageInfo: { hasNextPage: more, endCursor: cursor } } } });
function load(graphql) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/features/shipments/transferDispatchGoods.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'exports', 'module', code)(() => ({ graphql }), mod.exports, mod);
  return mod.exports;
}
const line = (id, productId, quantity) => ({ id, productId, sku: productId, productName: `Product ${productId}`, quantity });
const carton = (id, lineId) => ({ id, documentId: issueId, lineId, cartonId: id, scannedAt: null });

test('transfer products include every issue line and every carton page, grouped by product identity', async () => {
  const api = load(async (query, variables) => {
    if (query.includes('warehouseDocuments(')) {
      assert.match(query, /kind: \{ eq: "Issue" \}, reason: \{ eq: "Transfer" \}/);
      return page('warehouseDocuments', [{ id: issueId, code: 'PXK-T', warehouseId: 'source' }]);
    }
    assert.ok(query.includes(`documentId: { eq: "${issueId}" }`));
    if (query.includes('warehouseDocumentLines(')) return variables.after === null
      ? page('warehouseDocumentLines', [line('l1', 'p1', 2)], true, 'line-next')
      : page('warehouseDocumentLines', [line('l2', 'p1', 1), line('l3', 'p2', 1), line('l4', 'p3', 2)]);
    return variables.after === null
      ? page('warehouseDocumentCartons', [carton('CID-2', 'l1'), carton('CID-1', 'l2')], true, 'carton-next')
      : page('warehouseDocumentCartons', [carton('CID-3', 'l3')]);
  });
  const products = await api.fetchTransferDispatchGoods(issueId);
  assert.equal(products.length, 3);
  assert.equal(products[0].quantity, 3);
  assert.deepEqual(products[0].cartons.map(row => row.cartonId), ['CID-1', 'CID-2']);
  assert.deepEqual(products[1].cartons.map(row => row.cartonId), ['CID-3']);
  assert.deepEqual(products[2].cartons, []);
  assert.equal(products[0].cartons[0].documentCode, 'PXK-T');
});

test('wrong-document cartons fail closed instead of appearing on another transfer', async () => {
  const api = load(async query => query.includes('warehouseDocuments(')
    ? page('warehouseDocuments', [{ id: issueId, code: 'PXK', warehouseId: 'w' }])
    : query.includes('warehouseDocumentLines(') ? page('warehouseDocumentLines', [line('l', 'p', 1)])
      : page('warehouseDocumentCartons', [{ ...carton('CID', 'l'), documentId: 'another-issue' }]));
  await assert.rejects(api.fetchTransferDispatchGoods(issueId), /không khớp/);
});

test('missing scope, provider errors and broken pagination are surfaced', async () => {
  await assert.rejects(load(async () => page('warehouseDocuments', [])).fetchTransferDispatchGoods(issueId), /không có quyền/);
  await assert.rejects(load(async () => { throw new Error('Forbidden'); }).fetchTransferDispatchGoods(issueId), /Forbidden/);
  await assert.rejects(load(async () => page('warehouseDocuments', [], true, 'repeated')).fetchTransferDispatchGoods(issueId), /Phân trang/);
  await assert.rejects(load(async () => assert.fail('no network for invalid ID')).fetchTransferDispatchGoods('bad'), /không hợp lệ/);
});
