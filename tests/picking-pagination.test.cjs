const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function source(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)((name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith('.') || name.startsWith('@/')) throw new Error('Missing boundary mock: ' + name);
    return require(name);
  }, module, module.exports);
  return module.exports;
}

const errors = source('shared/api/errors.ts');
const calls = [];
let responder = () => ({});
const gql = source('features/runpicking/pickingGraphql.ts', {
  '@/shared/api/graphql': { graphql: async (query, variables) => { calls.push({ query, variables }); return responder(query, variables); } },
  '@/shared/api/errors': errors,
});

test('page size is a validated literal; filters are literal structure with scalar variables (Backend cost rules)', () => {
  const { query, variables } = gql.buildPickingPageQuery({ size: 20, status: 'Pending', warehouseId: 'w-1' });
  assert.match(query, /page: pickingLists\(first: 20, where: \{ and: \[\{ warehouseId: \{ eq: \$wh \} \}, \{ status: \{ eq: \$st \} \}\] \}/);
  assert.doesNotMatch(query, /\$first|\$where/);
  assert.deepEqual(variables, { wh: 'w-1', st: 'Pending' });
  assert.throws(() => gql.buildPickingPageQuery({ size: 1000 }));
});

test('forward uses first/after, backward uses last/before; only used variables are declared', () => {
  const fwd = gql.buildPickingPageQuery({ size: 10, after: 'c1' });
  assert.match(fwd.query, /first: 10, after: \$after/);
  assert.match(fwd.query, /query PickingListPage\(\$after: String!\)/);
  const back = gql.buildPickingPageQuery({ size: 10, before: 'c2' });
  assert.match(back.query, /last: 10, before: \$before/);
  assert.deepEqual(back.variables, { before: 'c2' });
  const plain = gql.buildPickingPageQuery({ size: 10 });
  assert.match(plain.query, /query PickingListPage \{/);
});

test('Warehouse Keeper scope is always applied to the page and to the status counts', () => {
  const { query, variables } = gql.buildPickingPageQuery({ size: 10, scopeWarehouseIds: ['a', 'b'] });
  assert.deepEqual(variables.scope, ['a', 'b']);
  const scoped = query.match(/warehouseId: \{ in: \$scope \}/g) ?? [];
  assert.equal(scoped.length, 4); // page + 3 status counts
});

test('missing pagination metadata is an error, never a made-up total', async () => {
  responder = () => ({ entities: { page: { nodes: [] }, inProgress: { totalCount: 0 }, completed: { totalCount: 0 }, exception: { totalCount: 0 } } });
  await assert.rejects(gql.fetchPickingListPage({ size: 10 }), /thiếu thông tin phân trang/);
});

test('empty page returns the real total and no extra lookups', async () => {
  calls.length = 0;
  responder = () => ({ entities: {
    page: { totalCount: 0, pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null }, nodes: [] },
    inProgress: { totalCount: 0 }, completed: { totalCount: 0 }, exception: { totalCount: 0 },
  } });
  const page = await gql.fetchPickingListPage({ size: 10, status: 'Exception' });
  assert.equal(page.totalCount, 0);
  assert.deepEqual(page.rows, []);
  assert.equal(calls.length, 1);
});

test('invalid cursor and GraphQL errors are shown as business messages, not Backend internals', async () => {
  responder = () => { throw new errors.ApiError(400, 'Không tải được dữ liệu', 'The cursor specified in `after` has an invalid format.', 'HC0078'); };
  await assert.rejects(gql.fetchPickingListPage({ size: 10, after: 'bad' }), (e) => e.detail === 'Trang đã chọn không còn hợp lệ. Hãy quay về trang đầu.');
  responder = () => { throw new errors.ApiError(403, 'x', 'The current user is not authorized to access this resource.', 'AUTH_NOT_AUTHORIZED'); };
  await assert.rejects(gql.fetchPickingListPage({ size: 10 }), (e) => e.status === 403 && /không có quyền/.test(e.detail));
});
