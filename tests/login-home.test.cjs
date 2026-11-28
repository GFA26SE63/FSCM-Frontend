const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function destination(user) {
  const mocks = {
    '@/shared/router/compat': {
      Navigate: ({ to, replace }) => React.createElement('span', { 'data-replace': replace }, to),
    },
    '@/shared/auth/AuthContext': { useAuth: () => ({ user }) },
    '@/shared/auth/guards': {},
    './layout/AppLayout': {}, './pages/LoginPage': {}, './pages/NotFoundPage': {},
    './pages/PayOsCallbackPage': {},
    './routes': {
      // Warehouse routes may precede dashboard for navigation purposes.
      APP_ROUTES: [{ key: 'warehouse-inbound' }, { key: 'dashboard' }],
      HOME_BY_ROLE: { Admin: '/dashboard' },
    },
  };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/app/router.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'exports', 'module', code + '\nexports.Home = Home;')(
    name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), mod.exports, mod,
  );
  return renderToStaticMarkup(React.createElement(mod.exports.Home));
}

test('Admin lands on dashboard regardless of route order or delegated grants', () => {
  for (const permissions of [undefined, [], ['warehouse-inbound']]) {
    const html = destination({ role: 'Admin', permissions });
    assert.match(html, />\/dashboard</);
    assert.match(html, /data-replace="true"/);
  }
});

test('non-Admin landing stays within delegated screen permissions', () => {
  assert.match(destination({ role: 'WarehouseKeeper', permissions: ['warehouse-inbound'] }), />\/warehouse-inbound</);
  assert.match(destination({ role: 'Operator', permissions: ['dashboard'] }), />\/dashboard</);
});

test('a user without screen grants lands on notifications', () => {
  assert.match(destination({ role: 'Operator', permissions: [] }), />\/notifications</);
});

test('a missing session redirects to login', () => {
  assert.match(destination(null), />\/login</);
});
