const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

// Execute the real TS/TSX modules with explicit boundary mocks; no browser or DB required.
function source(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const module = { exports: {} };
  const imports = (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith('.') || name.startsWith('@/')) {
      throw new Error('Missing boundary mock: ' + name + ' in ' + file);
    }
    return require(name);
  };
  new Function('require', 'module', 'exports', code)(imports, module, module.exports);
  return module.exports;
}

const errors = source('shared/api/errors.ts');
const permissions = source('shared/auth/permissions.ts', {
  '../api/errors': errors,
  '../lib/env': { env: { useMock: false } },
});
const roles = ['Admin', 'Operator', 'WarehouseKeeper', 'SalesManager'];
const user = (role) => ({ id: 'user-' + role, role, name: role, email: role + '@example.com' });

test('only Admin manages groups and loyalty; collection stays Operator-only', () => {
  for (const role of roles) {
    assert.equal(permissions.can(user(role), 'salesGroups.manage'), role === 'Admin');
    assert.equal(permissions.can(user(role), 'loyalty.manage'), role === 'Admin');
    assert.equal(permissions.can(user(role), 'payments.collect'), role === 'Operator');
    assert.equal(permissions.can(user(role), 'territory.assign'), ['Admin', 'SalesManager'].includes(role));
  }
  assert.throws(() => permissions.assertPermission(null, 'users.manage'), { status: 401 });
  assert.throws(() => permissions.assertPermission(user('Operator'), 'loyalty.manage'), { status: 403 });
});

test('sidebar and direct URL guard handle all Portal roles, loading and anonymous sessions', () => {
  let session = { status: 'authenticated', user: null };
  const auth = { useAuth: () => session };
  const routes = source('app/routes.tsx');
  const Link = ({ to, children }) => React.createElement('a', { href: to }, children);
  const ui = {
    useToast: () => ({ error() {} }),
    EmptyState: ({ title }) => React.createElement('p', null, title),
  };
  const router = { NavLink: Link, useNavigate: () => () => {}, useLocation: () => ({ pathname: '/users' }),
    Navigate: () => React.createElement('p', null, 'LOGIN') };
  const { Sidebar } = source('app/layout/Sidebar.tsx', {
    '@/shared/router/compat': router,
    '@/shared/auth/AuthContext': auth,
    '@/shared/auth/roles': source('shared/auth/roles.ts'),
    '@/shared/lib/env': { env: { useMock: false } },
    '@/shared/ui': ui,
    '@/features/notifications': { useMenuBadges: () => ({ data: {} }) },
    '../routes': routes,
  });
  const { RequireRole, RequireAuth } = source('shared/auth/guards.tsx', {
    '@/shared/router/compat': router,
    './AuthContext': auth,
    '../ui/EmptyState': ui,
  });
  for (const role of roles) {
    session = { status: 'authenticated', user: user(role) };
    const menu = renderToStaticMarkup(React.createElement(Sidebar));
    assert.equal(menu.includes('href="/users"'), role === 'Admin');
    assert.equal(menu.includes('href="/debts"'), ['Admin', 'Operator'].includes(role));
    assert.equal(menu.includes('href="/regions"'), ['Admin', 'SalesManager'].includes(role));
    assert.equal(menu.includes('href="/runpicking"'), role !== 'SalesManager');
    const direct = renderToStaticMarkup(React.createElement(RequireRole, { roles: ['Admin'] }, 'SECRET'));
    assert.equal(direct.includes('SECRET'), role === 'Admin');
    assert.equal(direct.includes('403'), role !== 'Admin');
  }
  session = { status: 'loading', user: null };
  assert.ok(!renderToStaticMarkup(React.createElement(RequireRole, { roles: ['Admin'] }, 'SECRET')).includes('SECRET'));
  session = { status: 'anonymous', user: null };
  assert.match(renderToStaticMarkup(React.createElement(RequireAuth, null, 'SECRET')), /LOGIN/);
});

test('Operator can view loyalty but cannot open its edit form or run update mutation', async () => {
  let current = user('Operator');
  let writes = 0;
  const auth = { useAuth: () => ({ user: current }) };
  const hookMocks = {
    '@tanstack/react-query': { useQuery() {} },
    '@/shared/hooks': {
      useApiMutation: (fn, options) => ({ mutateAsync: async (input) => {
        permissions.assertPermission(current, options.permission);
        return fn(input);
      } }),
    },
    './api': { loyaltyApi: { updateProgram: async () => { writes += 1; } } },
  };
  const mutationHooks = source('features/loyalty/hooks.ts', hookMocks);
  await assert.rejects(mutationHooks.useUpdateProgram().mutateAsync({}), { status: 403 });
  assert.equal(writes, 0);
  const Wrapper = ({ children, actions }) => React.createElement('div', null, actions, children);
  const { LoyaltyPage } = source('features/loyalty/pages/LoyaltyPage.tsx', {
    '@/shared/auth/AuthContext': auth,
    '@/shared/auth/permissions': permissions,
    '@/shared/router/compat': { useNavigate: () => () => {} },
    '@/shared/ui': {
      Button: ({ children, onClick }) => React.createElement('button', { onClick }, children),
      Card: Wrapper, PageHeader: Wrapper, Fields: () => null, DataTable: () => null,
      StatusChip: () => null,
      FormDialog: ({ open }) => open ? React.createElement('p', null, 'EDIT FORM') : null,
    },
    '@/shared/lib': { formatDate: String, formatMoney: String, formatNumber: String },
    '../hooks': {
      useProgram: () => ({ data: { code: 'L1', name: 'Program', status: 'Running' } }),
      useBalances: () => ({}), useUpdateProgram: () => ({}),
    },
  });
  assert.ok(!renderToStaticMarkup(React.createElement(LoyaltyPage)).includes('Sửa'));
  current = user('Admin');
  assert.match(renderToStaticMarkup(React.createElement(LoyaltyPage)), /Sửa/);
  await mutationHooks.useUpdateProgram().mutateAsync({});
  assert.equal(writes, 1);
});

test('manager territory uses scoped assignment reads and never the Admin user directory', async () => {
  const calls = [];
  const current = { ...user('SalesManager'), scope: { salesGroupIds: ['g1'] } };
  const { loadManagerTerritory, requireManagedGroup } = source('features/regions/managerTerritory.ts', {
    '@/shared/api/errors': errors,
    '@/shared/api/http': { get: async (url, params) => {
      calls.push({ url, params });
      if (url === '/sales-groups') return [
        { id: 'g1', code: 'A', name: 'Own', regionId: 'r1', regionCode: 'R', regionName: 'Region', isActive: true },
        { id: 'g2', code: 'B', regionId: 'r2', isActive: true },
      ];
      if (url === '/regions') return [{ id: 'r1', code: 'R', name: 'Region', isActive: true }, { id: 'r2' }];
      assert.equal(params.salesGroupId, 'g1');
      if (url === '/territory-assignments/sales') return [{ userId: 's1', userFullName: 'Sales', userEmail: 's@example.com', isActive: true }];
      if (url === '/territory-assignments/retailers') return [{ retailerId: 'ret1', isActive: true }];
      throw new Error('Unexpected request: ' + url);
    } },
  });
  const data = await loadManagerTerritory(current);
  assert.deepEqual(data.groups.map((g) => g.id), ['g1']);
  assert.deepEqual(data.areas.map((r) => r.id), ['r1']);
  assert.equal(data.staff[0].userId, 's1');
  assert.ok(!calls.some((c) => c.url.startsWith('/users')));
  assert.equal(requireManagedGroup(data, 'A').id, 'g1');
  assert.throws(() => requireManagedGroup(data, 'g2'), { status: 403 });
  calls.length = 0;
  assert.deepEqual(await loadManagerTerritory({ ...current, scope: undefined }), { areas: [], groups: [], staff: [] });
  assert.equal(calls.length, 0);
});

test('revoked manager scope errors propagate instead of becoming an empty successful result', async () => {
  const forbidden = new errors.ApiError(403, 'Scope revoked');
  const { loadManagerTerritory } = source('features/regions/managerTerritory.ts', {
    '@/shared/api/errors': errors,
    '@/shared/api/http': { get: async (url) => {
      if (url === '/sales-groups') return [{ id: 'g1', isActive: true }];
      if (url === '/regions') return [];
      throw forbidden;
    } },
  });
  await assert.rejects(loadManagerTerritory({ ...user('SalesManager'), scope: { salesGroupIds: ['g1'] } }), (e) => e === forbidden);
});

test('REST and GraphQL distinguish forbidden operations from expired sessions', async () => {
  let unauthorized = 0;
  let rejectResponse;
  const tokenStore = { get: () => 'test-token', onUnauthorized: () => { unauthorized += 1; } };
  source('shared/api/http.ts', {
    axios: { __esModule: true, default: { create: () => ({
      interceptors: {
        request: { use() {} },
        response: { use: (_success, failure) => { rejectResponse = failure; } },
      },
    }) } },
    '../lib/env': { env: { apiBaseUrl: 'https://api.example.test' } },
    '../auth/tokenStore': { tokenStore },
    './errors': errors,
  });
  await assert.rejects(rejectResponse(new errors.ApiError(403, 'Denied')), { status: 403 });
  assert.equal(unauthorized, 0);
  await assert.rejects(rejectResponse(new errors.ApiError(401, 'Expired')), { status: 401 });
  assert.equal(unauthorized, 1);

  let code = 'AUTH_NOT_AUTHORIZED';
  const { graphql } = source('shared/api/graphql.ts', {
    './http': { http: { post: async () => ({ data: { errors: [{ message: 'Access denied', extensions: { code } }] } }) } },
    './errors': errors,
    '../lib/env': { env: { apiBaseUrl: 'https://api.example.test' } },
    '../auth/tokenStore': { tokenStore },
  });
  await assert.rejects(graphql('query {}'), { status: 403, detail: 'Access denied' });
  assert.equal(unauthorized, 1);
  code = 'AUTH_NOT_AUTHENTICATED';
  await assert.rejects(graphql('query {}'), { status: 401 });
  assert.equal(unauthorized, 2);
});
