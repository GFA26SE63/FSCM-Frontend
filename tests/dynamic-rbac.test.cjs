const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(file, mocks) {
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  new Function('require', 'module', 'exports', code)(name => mocks[name] ?? require(name), mod, mod.exports);
  return mod.exports;
}
const errors = load('shared/api/errors.ts', {});
const permissions = load('shared/auth/permissions.ts', { '../api/errors': errors });

test('Admin retains every UI action, screen and operation with an empty delegated grant list', () => {
  const admin = { role: 'Admin', permissions: [] };
  for (const action of Object.keys(permissions.ACTION_SCREENS)) assert.equal(permissions.can(admin, action), true, action);
  for (const screen of Object.values(permissions.ACTION_SCREENS)) assert.equal(permissions.hasScreen(admin, screen), true, screen);
  for (const operation of Object.values(permissions.ACTION_OPERATIONS).flat()) assert.equal(permissions.hasOperation(admin, operation), true, operation);
});
test('operation delegation is independent of business profile and missing grants fail closed', () => {
  for (const role of ['Operator', 'WarehouseKeeper', 'SalesManager', 'Sales', 'Retailer']) {
    const user = { role, permissions: ['api:Shipments.Assign', 'api:Retailers.UpdateProfile'] };
    assert.equal(permissions.hasOperation(user, 'api:Shipments.Assign'), true);
    assert.equal(permissions.hasOperation(user, 'api:Shipments.Dispatch'), false);
    assert.equal(permissions.can(user, 'retailers.edit'), true);
    assert.equal(permissions.hasScreen(user, 'readiness'), false);
    assert.equal(permissions.can({ role }, 'retailers.edit'), false);
    assert.equal(permissions.can({ role, permissions: [] }, 'retailers.edit'), false);
  }
});
test('dispatch transport reads use selected GraphQL fields and reject incomplete cursor pages', async () => {
  const calls = [];
  const api = load('features/shipments/api.ts', {
    '@/shared/api/http': {}, '@/shared/api/errors': errors,
    './shipmentsGraphql': {},
    '@/shared/api/graphql': { graphql: async (query, variables) => {
      calls.push({ query, variables });
      return { entities: { drivers: { nodes: [{ id: 'd' }], pageInfo: { hasNextPage: true, endCursor: null } } } };
    } },
  }).shipmentsApi;
  await assert.rejects(api.drivers(), { status: 502 });
  assert.match(calls[0].query, /drivers\(first: 100/);
  assert.match(calls[0].query, /id warehouseId code fullName isActive/);
  assert.doesNotMatch(calls[0].query, /licenseNumber|phone/);
});
