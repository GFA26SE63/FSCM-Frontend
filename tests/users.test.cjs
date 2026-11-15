const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function source(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)((name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith('.') || name.startsWith('@/')) throw new Error('Missing mock: ' + name);
    return require(name);
  }, module, module.exports);
  return module.exports;
}

const errors = source('shared/api/errors.ts');
function apiWith(graphql) {
  return source('features/users/api.ts', {
    '@/shared/api/errors': errors,
    '@/shared/api/http': {},
    '@/shared/api/graphql': { graphql },
    './userPolicy': { assertCreatableRole() {} },
  }).userApi;
}

test('account history is filtered by target entity, paginated and excludes raw sensitive snapshots', async () => {
  let request;
  const page = { nodes: [], pageInfo: { hasNextPage: true, endCursor: 'next' } };
  const api = apiWith(async (query, variables) => {
    request = { query, variables };
    return { entities: { auditLogs: page } };
  });
  assert.deepEqual(await api.audit('target-user', 'previous'), page);
  assert.deepEqual(request.variables, { userId: 'target-user', after: 'previous' });
  assert.match(request.query, /entityName:\s*\{ eq: "UserAccount" \}/);
  assert.match(request.query, /entityId:\s*\{ eq: \$userId \}/);
  assert.match(request.query, /first: 20/);
  assert.match(request.query, /after: \$after/);
  assert.match(request.query, /createdAt: DESC/);
  assert.doesNotMatch(request.query, /oldValues|newValues|password|token|email|phone/i);
});

test('history authorization failures remain errors rather than empty successful history', async () => {
  const denied = new errors.ApiError(403, 'Forbidden');
  const api = apiWith(async () => { throw denied; });
  await assert.rejects(api.audit('target-user', null), (error) => error === denied);
});

test('missing history or unusable next cursor is not treated as an empty page', async () => {
  for (const result of [
    { entities: null },
    { entities: { auditLogs: { nodes: [], pageInfo: { hasNextPage: true, endCursor: null } } } },
  ]) {
    const api = apiWith(async () => result);
    await assert.rejects(api.audit('target-user', null), { status: 502 });
  }
});

test('history is Admin-only and renders backend audit metadata without inventing a locking reason', () => {
  let role = 'Admin';
  const requests = [];
  const Wrap = ({ children }) => React.createElement('section', null, children);
  const { UserAuditPanel } = source('features/users/components/UserAuditPanel.tsx', {
    '@/shared/auth/AuthContext': { useAuth: () => ({ user: { role } }) },
    '@/shared/lib': { formatDateTime: (value) => value },
    '@/shared/ui': {
      Card: Wrap,
      Button: ({ children }) => React.createElement('button', null, children),
      QueryState: ({ query, children }) => children(query.data),
      SimpleTable: ({ rows, columns }) => React.createElement('div', null,
        rows.map((row) => React.createElement('div', { key: row.id },
          columns.map((column) => React.createElement('span', { key: column.header }, column.cell(row)))))),
    },
    '../hooks': { useUserAudit: (...args) => {
      requests.push(args);
      return { data: {
        nodes: [{ id: 'audit1', action: 'Deactivated', userAccountId: 'actor-id', createdAt: '2026-11-10', reason: null }],
        pageInfo: { hasNextPage: false, endCursor: null },
      } };
    } },
  });
  const render = () => renderToStaticMarkup(React.createElement(UserAuditPanel, { userId: 'target-user' }));
  const html = render();
  assert.match(html, /Khóa tài khoản/);
  assert.match(html, /actor-id/);
  assert.match(html, /Không được ghi nhận/);
  assert.deepEqual(requests.at(-1), ['target-user', null, true]);
  role = 'Operator';
  assert.equal(render(), '');
  assert.deepEqual(requests.at(-1), ['target-user', null, false]);
});

test('create-user dialog provides an accessible password visibility toggle', () => {
  const dialog = fs.readFileSync(
    path.resolve(__dirname, '../src/features/users/components/UserDialog.tsx'),
    'utf8',
  );

  assert.match(dialog, /const \[showPassword, setShowPassword\] = useState\(false\)/);
  assert.match(dialog, /type=\{showPassword \? 'text' : 'password'\}/);
  assert.match(dialog, /className="password-toggle"/);
  assert.match(dialog, /aria-label=\{showPassword \? 'Ẩn mật khẩu' : 'Hiện mật khẩu'\}/);
  assert.match(dialog, /onClick=\{\(\) => setShowPassword\(\(visible\) => !visible\)\}/);
});
