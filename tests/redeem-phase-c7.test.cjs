'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const read = (p) => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');
const gql = read('src/features/redeem/redeemGraphql.ts');
const page = read('src/features/redeem/pages/RedeemPage.tsx');
const api = read('src/features/redeem/api.ts');
const hooks = read('src/features/redeem/hooks.ts');

test('rewardRedemptions: literal paging, newest-first + id tiebreaker', () => {
  assert.ok(gql.includes('rewardRedemptions('));
  assert.ok(gql.includes('first: ${q.size}') && gql.includes('last: ${q.size}'));
  assert.ok(gql.includes('order: [{ createdAt: DESC }, { id: DESC }]') && gql.includes('{ id: DESC }]`'));
});
test('sort keys equal DataTable column keys and map to scalar fields', () => {
  assert.ok(/code: 'id',\s*quantity: 'quantity',\s*points: 'redeemedPoints',\s*at: 'createdAt'/.test(gql));
  for (const k of ['code', 'quantity', 'points', 'at']) assert.ok(page.includes(`key: '${k}'`), k);
});
test('screen statuses map to the server lifecycle words (Requested=Pending, Done=Completed)', () => {
  assert.ok(gql.includes("Requested: 'Pending'") && gql.includes("Done: 'Completed'"));
  assert.ok(gql.includes('AGED_STATUSES = [\'Pending\', \'Approved\', \'Delivered\']'));
  assert.ok(gql.includes('{ updatedAt: { lt:'));
});
test('search/region/group resolve to bounded id lookups; empty search match returns no rows', () => {
  assert.ok(gql.includes('{ retailerId: { in: $searchRetailerIds } }') && gql.includes('{ loyaltyRewardId: { in: $searchRewardIds } }'));
  assert.ok(gql.includes('{ id: { eq: $searchId } }') && gql.includes('NO_MATCH_ID'));
  assert.ok(gql.includes('{ regionId: { eq: $regionId } }') && gql.includes('{ unassignedAt: { eq: null } }'));
  assert.ok(hooks.includes('useRedeemScope'));
});
test('one batched enrichment request per page (no per-row calls)', () => {
  assert.ok(gql.includes('retailers(first: 100, where: { id: { in: $retailerIds } })'));
  assert.ok(gql.includes('retailerLoyalties(first: 100, where: { retailerId: { in: $retailerIds } })'));
  assert.ok((gql.match(/async function enrich/g) || []).length === 1);
});
test('no loyalty calculation in the client; mutations stay REST', () => {
  assert.ok(!/currentPoints\s*[-+]|heldPoints\s*[-+]/.test(gql));
  assert.ok(api.includes('`/loyalty/redemptions/${v.code}/${v.step}`'));
  assert.ok(read('src/features/redeem/hooks.ts').includes('useRedeemStep'));
});
test('detail reads one row by id via GraphQL instead of downloading the whole list', () => {
  assert.ok(api.includes('fetchRedemptionById(id)') && !api.includes("get<RedemptionApi[]>('/loyalty/redemptions').then((items) => {"));
});
test('page is cursor-based', () => {
  assert.ok(!page.includes('useRedemptions()') && page.includes('cursor={pagingProps}') && page.includes('serverSort='));
});
