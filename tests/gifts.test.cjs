const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');

function source(file, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../src', file), 'utf8'), {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith('.') || name.startsWith('@/')) throw Error('Missing mock: ' + name);
    return require(name);
  }, mod, mod.exports);
  return mod.exports;
}
class ApiError extends Error {}
const reward = { id: 'reward', loyaltyProgramId: 'program', code: 'QUA-001', name: 'Quà thử',
  requiredPoints: 50, availableQuantity: null, isActive: false, rewardType: 'Physical',
  description: 'Description', imageUrl: 'https://example.test/gift.png', discountAmount: null, discountPercent: null };
const input = { loyaltyProgramId: 'program', name: 'Quà thử', points: 50, stock: null, status: 'Active' };
function api(mocks) {
  return source('features/gifts/api.ts', {
    '@/shared/api/http': { get: async () => { throw Error('No REST list'); }, ...mocks },
    '@/shared/api/graphql': { graphql: mocks.graphql },
    '@/shared/api/errors': { ApiError, errorMessage: e => e.message },
    './imageUpload': source('features/gifts/imageUpload.ts'),
  }).giftApi;
}

test('gift list uses server GraphQL filters/paging and derives redeemed quantities without guessing legacy data', async () => {
  let calls = 0;
  const gifts = api({ graphql: async (query, variables) => {
    calls++;
    if (calls === 1) {
      assert.match(query, /first: 20/);
      assert.match(query, /isActive: \{ eq: true \}/);
      assert.match(query, /requiredPoints: ASC/);
      assert.equal(variables.search, 'Quà');
      assert.equal(variables.cursor, 'cursor');
      return { entities: { loyaltyRewards: {
        nodes: [{ ...reward, isActive: true }], totalCount: 42,
        pageInfo: { hasNextPage: true, hasPreviousPage: true, startCursor: 'start', endCursor: 'end' },
      } } };
    }
    assert.deepEqual(variables.ids, ['reward']);
    return { entities: { rewardRedemptions: {
      nodes: [{ loyaltyRewardId: 'reward', quantity: 3, requiredPointsSnapshot: 50, redeemedPoints: 150 }],
      pageInfo: { hasNextPage: false, endCursor: null },
    } } };
  } });
  const result = await gifts.list({ status: 'Active', search: 'Quà', sort: 'pointsAsc', after: 'cursor' });
  assert.equal(result.totalCount, 42);
  assert.equal(result.items[0].points, 50);
  assert.equal(result.items[0].stock, null);
  assert.equal(result.items[0].redeemed, 3);
  assert.equal(result.items[0].imageUrl, reward.imageUrl);
  assert.equal(calls, 2);
});

test('new gift program lookup filters active and effective programs on the server across pages', async () => {
  const requests = [];
  const gifts = api({ graphql: async (query, variables) => {
    requests.push({ query, variables });
    assert.match(query, /isActive: \{ eq: true \}/);
    assert.match(query, /startAt: \{ lte: \$now \}/);
    assert.match(query, /endAt: \{ gte: \$now \}/);
    assert.ok(Number.isFinite(Date.parse(variables.now)));
    return { entities: { loyaltyPrograms: {
      nodes: [{ id: `program-${requests.length}`, code: 'LP', name: 'Program', isActive: true }],
      pageInfo: { hasNextPage: requests.length === 1, endCursor: 'next' },
    } } };
  } });
  const rows = await gifts.programs(true);
  assert.equal(rows.length, 2);
  assert.equal(requests[1].variables.after, 'next');
  assert.equal(requests[1].variables.now, requests[0].variables.now);
});

test('editing can still resolve an inactive program already linked to a gift', async () => {
  const inactive = { id: 'old-program', code: 'OLD', name: 'Old program', isActive: false };
  const gifts = api({ graphql: async (query, variables) => {
    assert.ok(!query.includes('where:'));
    assert.ok(!Object.hasOwn(variables, 'now'));
    return { entities: { loyaltyPrograms: { nodes: [inactive], pageInfo: { hasNextPage: false } } } };
  } });
  assert.deepEqual(await gifts.programs(), [inactive]);
});

test('create explicitly activates, and activation failure preserves reward identity for safe retry', async () => {
  const calls = [];
  const gifts = api({ post: async (url, body) => {
    calls.push({ url, body });
    if (url.endsWith('/activate')) throw Error('Network timeout');
    return reward;
  } });
  const result = await gifts.create(input);
  assert.equal(result.gift.id, 'reward');
  assert.match(result.statusError, /Network timeout/);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].body.availableQuantity, null);
  assert.equal(calls[1].url, '/loyalty/rewards/reward/activate');
});

test('edit preserves type/discount fields and calls deactivate separately', async () => {
  let submitted;
  let statusUrl;
  const gifts = api({ put: async (url, body) => { submitted = body; return { ...reward, isActive: true, rewardType: 'Discount', discountAmount: 1000 }; },
    post: async url => { statusUrl = url; return { ...reward, rewardType: 'Discount', discountAmount: 1000 }; } });
  const result = await gifts.update({ ...input, id: 'reward', rewardType: 'Discount', discountAmount: 1000, status: 'Paused', stock: 0 });
  assert.equal(submitted.rewardType, 'Discount');
  assert.equal(submitted.discountAmount, 1000);
  assert.equal(submitted.availableQuantity, 0);
  assert.equal(statusUrl, '/loyalty/rewards/reward/deactivate');
  assert.equal(result.gift.status, 'Paused');
});

test('invalid gift quantities never reach the write API and missing metadata remains an error', async () => {
  let writes = 0;
  const gifts = api({ post: async () => { writes++; return reward; }, graphql: async () => ({ entities: {} }) });
  await assert.rejects(gifts.create({ ...input, points: 1.5 }));
  await assert.rejects(gifts.create({ ...input, stock: -1 }));
  await assert.rejects(gifts.list());
  assert.equal(writes, 0);
});

test('gift form preserves image/description and distinguishes unlimited stock from zero', async () => {
  let submitted;
  const { GiftDialog } = source('features/gifts/components/GiftDialog.tsx', {
    '@/shared/ui': { FormDialog: () => null, Callout: () => null },
    './GiftImagePicker': { GiftImagePicker: () => null },
  });
  const props = GiftDialog({ gift: null, programs: [{ id: 'program', code: 'LP', name: 'Program', isActive: true }],
    statusError: '', onClose() {}, onSubmit: async value => submitted = value }).props;
  assert.ok(props.fields.find(field => field.key === 'loyaltyProgramId').required);
  assert.ok(props.fields.find(field => field.key === 'points').validate(1.5));
  await props.onSubmit({ ...input, unlimited: true, stock: '', description: 'note', imageUrl: reward.imageUrl });
  assert.equal(submitted.stock, null);
  assert.equal(submitted.description, 'note');
  assert.equal(submitted.imageUrl, reward.imageUrl);
  await props.onSubmit({ ...input, unlimited: false, stock: 0 });
  assert.equal(submitted.stock, 0);
});

test('image upload uses multipart and keeps metadata JSON free of files', async () => {
  let metadata;
  let uploaded = false;
  const file = new Blob(['image bytes'], { type: 'image/png' });
  const gifts = api({
    post: async (url, body) => { metadata = body; return reward; },
    http: { post: async (url, form, config) => {
      assert.equal(url, '/loyalty/rewards/reward/image');
      assert.ok(form instanceof FormData);
      assert.equal(form.get('file').type, 'image/png');
      assert.equal(config.headers['Content-Type'], undefined);
      uploaded = true;
      return { data: { ...reward, imageUrl: 'https://blob.test/reward/key?sig=fresh', imageReference: 'reward/key' } };
    } },
  });
  const result = await gifts.create({ ...input, status: 'Paused', imageFile: file });
  assert.equal(uploaded, true);
  assert.equal(Object.hasOwn(metadata, 'imageFile'), false);
  assert.equal(result.gift.imageReference, 'reward/key');
  assert.match(result.gift.imageUrl, /sig=fresh/);
});

test('failed upload retains created reward identity and retry updates the same reward', async () => {
  let creates = 0;
  let updates = 0;
  let attempts = 0;
  const file = new Blob(['image'], { type: 'image/png' });
  const gifts = api({
    post: async () => { creates++; return reward; },
    put: async url => { assert.equal(url, '/loyalty/rewards/reward'); updates++; return reward; },
    http: { post: async () => {
      if (++attempts === 1) throw Error('Upload timeout');
      return { data: { ...reward, imageReference: 'reward/key', imageUrl: 'https://blob.test/image' } };
    } },
  });
  const draft = { ...input, status: 'Paused', imageFile: file };
  const first = await gifts.create(draft);
  assert.equal(first.gift.id, 'reward');
  assert.match(first.imageError, /Upload timeout/);
  const retry = await gifts.update({ ...draft, id: first.gift.id });
  assert.equal(retry.imageError, undefined);
  assert.equal(creates, 1);
  assert.equal(updates, 1);
});

test('image validation runs before metadata persistence', async () => {
  let writes = 0;
  const gifts = api({ post: async () => { writes++; return reward; } });
  await assert.rejects(gifts.create({ ...input, imageFile: { type: 'text/plain', size: 4 } }));
  await assert.rejects(gifts.create({ ...input, imageFile: { type: 'image/png', size: 10 * 1024 * 1024 + 1 } }));
  await assert.rejects(gifts.create({ ...input, imageFile: { type: 'image/png', size: 0 } }));
  assert.equal(writes, 0);
});

test('editing an uploaded image sends its stable reference rather than the signed display URL', async () => {
  let submitted;
  const { GiftDialog } = source('features/gifts/components/GiftDialog.tsx', {
    '@/shared/ui': { FormDialog: () => null, Callout: () => null },
    './GiftImagePicker': { GiftImagePicker: () => null },
  });
  const gift = { ...input, id: 'reward', code: 'QUA-1', imageUrl: 'https://blob.test/key?sig=expires', imageReference: 'reward/key' };
  const form = GiftDialog({ gift, programs: [], statusError: '', onSubmit: async value => submitted = value }).props;
  await form.onSubmit({ ...form.initial, stock: 5 });
  assert.equal(submitted.imageUrl, 'reward/key');
  assert.equal(submitted.imageFile, null);
});

test('managed images on a GraphQL page resolve fresh read URLs through item reads', async () => {
  let reads = 0;
  const gifts = api({
    get: async url => {
      reads++;
      assert.equal(url, '/loyalty/rewards/reward');
      return { ...reward, imageReference: 'reward/key', imageUrl: 'https://blob.test/key?sig=fresh' };
    },
    graphql: async query => query.includes('GiftPage') ? { entities: { loyaltyRewards: {
      nodes: [{ ...reward, imageUrl: 'reward/key' }], totalCount: 1,
      pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: 'a', endCursor: 'a' },
    } } } : { entities: { rewardRedemptions: { nodes: [], pageInfo: { hasNextPage: false } } } },
  });
  const page = await gifts.list();
  assert.equal(reads, 1);
  assert.equal(page.items[0].imageReference, 'reward/key');
  assert.equal(page.items[0].imageUrl, 'https://blob.test/key?sig=fresh');
});

test('redemption actions follow backend transitions, including rejection after approval', () => {
  const { allowedRedeemSteps, redemptionFeedback } = source('features/redeem/policy.ts');
  assert.deepEqual(allowedRedeemSteps('Requested'), ['approve', 'reject']);
  assert.deepEqual(allowedRedeemSteps('Approved'), ['deliver', 'reject']);
  assert.deepEqual(allowedRedeemSteps('Delivered'), ['complete']);
  assert.deepEqual(allowedRedeemSteps('Done'), []);
  assert.deepEqual(allowedRedeemSteps('Rejected'), []);
  assert.match(redemptionFeedback.approve, /giữ từ lúc gửi/);
  let rendered;
  const { renderToStaticMarkup } = require('react-dom/server');
  const { RedeemActions } = source('features/redeem/components/RedeemActions.tsx', {
    '@/shared/ui': { Button: ({ children, ...props }) => React.createElement('button', { disabled: props.disabled }, children), Callout: ({ children }) => React.createElement('div', null, children) },
    '@/shared/api/errors': { errorMessage: String },
    '@/shared/auth/AuthContext': { useAuth: () => ({ user: { role: 'Operator' } }) },
    '@/shared/auth/permissions': { can: () => true },
    '../hooks': { useRedeemStep: () => ({ isPending: false, error: null, mutate() {} }) },
    '../policy': { allowedRedeemSteps },
  });
  rendered = renderToStaticMarkup(React.createElement(RedeemActions, { x: { status: 'Approved', code: 'id' } }));
  assert.match(rendered, /Ghi nhận giao quà/);
  assert.match(rendered, /Từ chối/);
  assert.doesNotMatch(rendered, /Hoàn tất/);
});

test('loyalty card mapping preserves negative balance, balance after adjustment and source identities', async () => {
  const card = { retailerId: 'retailer', retailerCode: 'R-1', retailerName: 'Shop', availablePoints: -20,
    heldPoints: 10, pendingPoints: 3, expiredPoints: 0, programCode: 'LP', programName: 'Program',
    ledger: [{ transactionId: 'transaction', transactionType: 'EarnedAdjusted', points: -30, balanceAfter: -20,
      note: 'Financial adjustment', createdAt: '2026-11-16T00:00:00Z', salesOrderId: 'order', orderCode: 'DH-1',
      redemptionId: null, redemptionStatus: null }] };
  const { loyaltyApi } = source('features/loyalty/api.ts', {
    '@/shared/api/errors': { ApiError },
    '@/shared/api/http': { get: async url => url.startsWith('/loyalty/cards/') ? card : [], post() {}, put() {} },
  });
  const result = await loyaltyApi.retailer('R-1');
  assert.equal(result.available, -20);
  assert.equal(result.held, 10);
  assert.equal(result.ledger[0].salesOrderId, 'order');
  assert.equal(result.ledger[0].orderCode, 'DH-1');
  assert.equal(result.ledger[0].balanceAfter, -20);
});
