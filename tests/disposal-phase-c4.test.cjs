'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const read = (p) => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');
const gql = read('src/features/disposal/disposalGraphql.ts');
const page = read('src/features/disposal/pages/DisposalPage.tsx');
const api = read('src/features/disposal/api.ts');

test('uses writeOffs with literal first/last and newest-first + id tiebreaker', () => {
  assert.ok(gql.includes('writeOffs('));
  assert.ok(gql.includes('first: ${q.size}') && gql.includes('last: ${q.size}'));
  assert.ok(gql.includes('order: [{ createdAt: DESC }, { id: DESC }]'));
  assert.ok(gql.includes('{ id: DESC }]`'));
});
test('sort keys equal DataTable column keys and map to WriteOff scalars', () => {
  assert.ok(/code: 'writeOffCode',\s*at: 'createdAt'/.test(gql));
  for (const k of ['code', 'at']) assert.ok(page.includes(`key: '${k}'`), k);
});
test('search ORs writeOffCode with resolved warehouse ids; warehouse filter uses eq', () => {
  assert.ok(gql.includes('{ writeOffCode: { contains: $search } }'));
  assert.ok(gql.includes('{ warehouseId: { in: $searchWarehouseIds } }'));
  assert.ok(gql.includes('{ warehouseId: { eq: $warehouseId } }'));
});
test('item totals are one batched, cursor-looped query', () => {
  assert.ok(gql.includes('writeOffId: { in: $ids }') && gql.includes('hasNextPage endCursor'));
});
test('method parsing mirrors Backend ReadMetadata', () => {
  const m = (r) => { if (!r) return 'D'; try { const x = JSON.parse(r)?.Method; return typeof x === 'string' && x ? x : 'D'; } catch { return 'D'; } };
  assert.equal(m('{"Method":"Trả nhà cung cấp"}'), 'Trả nhà cung cấp');
  assert.equal(m('garbage'), 'D');
  assert.equal(m(null), 'D');
  assert.ok(gql.includes('JSON.parse(reason)'));
});
test('page is cursor-based; detail, candidates, create stay REST; no status/approval invented', () => {
  assert.ok(!page.includes('useDisposals()'));
  assert.ok(page.includes('cursor={pagingProps}') && page.includes('serverSort='));
  assert.ok(api.includes("'/disposals/candidates'") && api.includes("post<{ items: Disposal[] }>('/disposals'") && api.includes('`/disposals/${code}`'));
  assert.ok(page.includes('value="Disposed"'));
});
