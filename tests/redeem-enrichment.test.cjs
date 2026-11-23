const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function source(file, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith('.') || name.startsWith('@/')) throw Error('Missing mock: ' + name);
    return require(name);
  }, module, module.exports);
  return module.exports;
}
const { ApiError } = source('shared/api/errors.ts');
const load = graphql => source('features/redeem/redeemGraphql.ts', {
  '@/shared/api/graphql': { graphql }, '@/shared/api/errors': { ApiError },
});
const id = '11111111-1111-4111-8111-111111111111';
const row = { id, retailerId: 'retailer', loyaltyRewardId: 'gift', redeemedPoints: 80, quantity: 2,
  status: 'Pending', createdAt: '2026-11-23T00:00:00Z', updatedAt: '2026-11-23T01:00:00Z' };
const pageInfo = { startCursor: 'start', endCursor: 'end', hasNextPage: true, hasPreviousPage: true };
const connection = (nodes, hasNextPage = false, endCursor = null) => ({ entities: { page: { nodes, pageInfo: { hasNextPage, endCursor } } } });
function metadata(query) {
  if (query.includes('RedeemRetailersEnrich')) return connection([{ id: 'retailer', code: '1001', name: 'Shop', regionId: 'region' }]);
  if (query.includes('RedeemRewardsEnrich')) return connection([{ id: 'gift', code: 'GIFT-1', name: 'Gift' }]);
  if (query.includes('RedeemLoyaltiesEnrich')) return connection([{ retailerId: 'retailer', currentPoints: -20, heldPoints: 80 }]);
  if (query.includes('RedeemGroupsEnrich')) return connection([{ retailerId: 'retailer', salesGroupId: 'group' }]);
  throw Error('Unexpected query');
}

test('enrichment avoids the 1306 type-cost request and preserves all row fields and main-page metadata', async () => {
  const calls = [];
  const api = load(async (query, variables) => {
    calls.push({ query, variables });
    // Regression for the reported 100+100+100+1000 query, rejected at a 1000 limit.
    const requested = [...query.matchAll(/first:\s*(\d+)/g)].reduce((sum, match) => sum + Number(match[1]), 0);
    if (requested + 6 > 1000) throw new ApiError(400, 'Maximum allowed type cost exceeded', undefined, 'HC0047');
    if (query.includes('query RedeemPage')) return { entities: { page: { nodes: [row, { ...row, id: 'second', quantity: null }], totalCount: 90, pageInfo } } };
    assert.equal((query.match(/first: 100/g) || []).length, 1);
    assert.match(query, /order: \[\{ id: ASC \}\]/);
    if (variables.retailerIds) assert.deepEqual(variables.retailerIds, ['retailer']);
    if (variables.rewardIds) assert.deepEqual(variables.rewardIds, ['gift']);
    return metadata(query);
  });
  const result = await api.fetchRedeemPage({ size: 50, after: 'previous', status: 'Requested', sort: { field: 'points', direction: 'asc' } });
  assert.equal(calls.length, 5); // One main page and four batches, never one query per row.
  assert.equal(result.totalCount, 90); assert.deepEqual(result.pageInfo, pageInfo);
  assert.match(calls[0].query, /first: 50/);
  assert.match(calls[0].query, /redeemedPoints: ASC/);
  assert.equal(calls[0].variables.status, 'Pending');
  assert.equal(calls[0].variables.after, 'previous');
  const actual = result.rows[0];
  assert.equal(actual.retailerName, 'Shop'); assert.equal(actual.retailerCode, '1001');
  assert.equal(actual.rewardCode, 'GIFT-1'); assert.equal(actual.rewardName, 'Gift');
  assert.equal(actual.heldPoints, 80); assert.equal(actual.balanceAfter, -20);
  assert.equal(actual.redeemedPoints, 80); assert.equal(actual.quantity, 2);
  assert.equal(actual.regionId, 'region'); assert.deepEqual(actual.salesGroupIds, ['group']);
  assert.equal(result.rows[1].quantityIsEstimated, true);
});

test('all group assignments are collected across pages instead of truncating after a smaller limit', async () => {
  const cursors = [];
  const api = load(async (query, variables) => {
    if (query.includes('query RedeemPage')) return { entities: { page: { nodes: [row], totalCount: 1, pageInfo } } };
    if (!query.includes('RedeemGroupsEnrich')) return metadata(query);
    cursors.push(variables.after);
    assert.match(query, /isActive: \{ eq: true \}/);
    assert.match(query, /unassignedAt: \{ eq: null \}/);
    return variables.after
      ? connection([{ retailerId: 'retailer', salesGroupId: 'group-100' }])
      : connection(Array.from({ length: 100 }, (_, i) => ({ retailerId: 'retailer', salesGroupId: `group-${i}` })), true, 'more');
  });
  const result = await api.fetchRedeemPage({ size: 10, before: 'next' });
  assert.deepEqual(cursors, [null, 'more']);
  assert.equal(result.rows[0].salesGroupIds.length, 101);
  assert.equal(result.rows[0].salesGroupIds.at(-1), 'group-100');
});

test('missing enrichment connections, metadata and broken cursor chains are errors rather than empty successful rows', async () => {
  for (const invalid of [
    { entities: {} },
    { entities: { page: { nodes: [] } } },
    connection([], true, null),
    connection([], true, 'loop'),
  ]) {
    const api = load(async query => {
      if (query.includes('query RedeemPage')) return { entities: { page: { nodes: [row], totalCount: 1, pageInfo } } };
      if (query.includes('RedeemLoyaltiesEnrich')) return invalid;
      return metadata(query);
    });
    await assert.rejects(api.fetchRedeemPage({ size: 20 }), { status: 502 });
  }
});

test('empty verified connections preserve no-balance semantics; an empty main page skips enrichment', async () => {
  let empty = false; let calls = 0;
  const api = load(async query => {
    calls++;
    if (query.includes('query RedeemPage')) return { entities: { page: { nodes: empty ? [] : [row], totalCount: empty ? 0 : 1, pageInfo } } };
    return query.includes('RedeemLoyaltiesEnrich') || query.includes('RedeemGroupsEnrich') ? connection([]) : metadata(query);
  });
  const result = await api.fetchRedeemPage({ size: 20 });
  assert.equal(result.rows[0].balanceAfter, 0); assert.equal(result.rows[0].heldPoints, null);
  assert.deepEqual(result.rows[0].salesGroupIds, []);
  empty = true; calls = 0;
  assert.deepEqual((await api.fetchRedeemPage({ size: 20 })).rows, []); assert.equal(calls, 1);
});

test('detail uses the same bounded enrichment and propagates permission failures', async () => {
  let failure;
  const api = load(async query => {
    if (query.includes('RedeemById')) return { entities: { rewardRedemptions: { nodes: [row] } } };
    if (query.includes('RedeemGroupsEnrich') && failure) throw failure;
    return metadata(query);
  });
  assert.equal((await api.fetchRedemptionById(id)).rewardCode, 'GIFT-1');
  failure = new ApiError(403, 'Forbidden');
  await assert.rejects(api.fetchRedemptionById(id), { status: 403 });
});
