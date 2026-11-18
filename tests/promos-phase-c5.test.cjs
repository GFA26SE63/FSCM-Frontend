'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const read = (p) => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');
const gql = read('src/features/promos/promosGraphql.ts');
const page = read('src/features/promos/pages/PromosPage.tsx');
const api = read('src/features/promos/api.ts');

test('promotions query: Campaign only (parity with REST list), literal paging, newest-first + id tiebreaker', () => {
  assert.ok(gql.includes('promotions(') && gql.includes('{ promotionType: { eq: "Campaign" } }'));
  assert.ok(gql.includes('first: ${q.size}') && gql.includes('last: ${q.size}'));
  assert.ok(gql.includes('order: [{ createdAt: DESC }, { id: DESC }]') && gql.includes('{ id: DESC }]`'));
});
test('sort keys equal DataTable column keys and map to Promotion scalars', () => {
  assert.ok(/code: 'code',\s*name: 'name',\s*period: 'startAt'/.test(gql));
  for (const k of ['code', 'name', 'period']) assert.ok(page.includes(`key: '${k}'`), k);
});
test('status filter mirrors promoStatus: Ended > Paused > Scheduled > Running', () => {
  assert.ok(gql.includes('{ endAt: { lt: ${now} } }'));
  assert.ok(gql.includes('{ isActive: { eq: false } }'));
  assert.ok(gql.includes('{ startAt: { gt: ${now} } }') && gql.includes('{ startAt: { lte: ${now} } }'));
  assert.ok(gql.includes('ISO_INSTANT'));
});
test('search ORs code and name; page is cursor-based; detail and writes stay REST', () => {
  assert.ok(gql.includes('{ code: { contains: $search } }') && gql.includes('{ name: { contains: $search } }'));
  assert.ok(!page.includes('usePromos()') && page.includes('cursor={pagingProps}') && page.includes('serverSort='));
  assert.ok(api.includes("get<PromoDetail>(`/promotions/${id}`)") && api.includes("'/promotions/campaigns'"));
});
