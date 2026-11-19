'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const read = (p) => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');
const gql = read('src/features/receipts/receiptsGraphql.ts');
const page = read('src/features/receipts/pages/ReceiptsPage.tsx');

test('uses goodsReceipts with literal first/last, default newest-first with id tiebreaker', () => {
  assert.ok(gql.includes('goodsReceipts('));
  assert.ok(gql.includes('first: ${q.size}') && gql.includes('last: ${q.size}'));
  assert.ok(gql.includes('order: [{ createdAt: DESC }, { id: DESC }]'));
  assert.ok(gql.includes('{ id: DESC }]`'));
});
test('sort allowlist limited to Receipt scalar fields', () => {
  assert.ok(/receiptCode: 'receiptCode',\s*createdAt: 'createdAt',\s*receivedAt: 'receivedAt'/.test(gql));
});
test('search ORs receiptCode with resolved warehouse ids; filters use eq', () => {
  assert.ok(gql.includes('{ receiptCode: { contains: $search } }'));
  assert.ok(gql.includes('{ warehouseId: { in: $searchWarehouseIds } }'));
  assert.ok(gql.includes('{ status: { eq: $status } }') && gql.includes('{ warehouseId: { eq: $warehouseId } }'));
});
test('line totals are one batched, cursor-looped query (no N+1)', () => {
  assert.ok(gql.includes('goodsReceiptId: { in: $ids }'));
  assert.ok(gql.includes('hasNextPage endCursor'));
});
test('page no longer loads the REST full collection; approve (REST write) kept', () => {
  assert.ok(!page.includes('useReceipts()'));
  assert.ok(page.includes('useReceiptsPage(') && page.includes('useApproveReceipt'));
  assert.ok(page.includes('cursor={pagingProps}') && page.includes('serverSort='));
  assert.ok(read('src/features/receipts/api.ts').includes("'/goods-receipts'"));
});

test('detail code lookup no longer downloads all receipts; detail + writes stay REST', () => {
  const api = read('src/features/receipts/api.ts');
  assert.ok(api.includes('findReceiptIdByCode(value)'));
  assert.ok(!api.includes("getAll<ReceiptDetail>('/goods-receipts')\n\n  const receipt"));
  assert.ok(api.includes("get<ReceiptDetail>(`/goods-receipts/${encodeURIComponent(id)}`)"));
  assert.ok(api.includes("http.post<ReceiptDetail>('/goods-receipts'") && api.includes('/approve'));
  assert.ok(gql.includes('findReceiptIdByCode'));
});
test('sort keys equal DataTable column keys (Batches regression guard)', () => {
  for (const k of ['receiptCode', 'createdAt', 'receivedAt']) assert.ok(page.includes(`key: '${k}'`), k);
});
