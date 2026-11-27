const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const path = require('node:path');

function render(role, status = 'AwaitingVerification') {
  const filename = path.join(__dirname, '../src/features/refunds/pages/RefundDetailPage.tsx');
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const mocks = {
    '@/shared/auth/AuthContext': { useAuth: () => ({ user: { id: 'self', role } }) },
    '@/shared/auth/permissions': { can: () => true },
    '@/shared/router/compat': { useNavigate: () => () => {} },
    '@/shared/ui': {
      Button: ({ children }) => React.createElement('button', null, children),
      PageHeader: ({ actions }) => React.createElement('header', null, actions),
      Callout: ({ children }) => React.createElement('p', null, children),
      Card: ({ children }) => React.createElement('section', null, children),
      Fields: () => null, FormDialog: () => null, Modal: () => null,
    },
    '@/shared/lib': { formatMoney: String, formatDateTime: String, toIsoDateTime: () => '' },
    '../api': {},
    '../hooks': { useVerifyRefund: () => ({}), useSubmitRefundEvidence: () => ({}) },
    './RefundsPage': { RefundStatusChip: () => null },
  };
  const mod = { exports: {} };
  new Function('require', 'exports', 'module', code + '\nexports.Detail = RefundDetail;')(
    name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), mod.exports, mod);
  return renderToStaticMarkup(React.createElement(mod.exports.Detail, { refund: {
    id: 'refund', status, submittedByUserId: 'self', orderCode: 'DH-1',
    confirmedAmount: 100, adjustedAmount: 50,
  } }));
}

test('Admin sees verification for own submitted evidence without requiring another user', () => {
  const html = render('Admin');
  assert.match(html, /<button>Xác minh<\/button>/);
  assert.doesNotMatch(html, /không được tự xác minh/);
});

test('non-Admin self verification remains blocked, and Admin still needs evidence', () => {
  assert.doesNotMatch(render('Operator'), /<button>Xác minh<\/button>/);
  assert.match(render('Operator'), /không được tự xác minh/);
  assert.doesNotMatch(render('Admin', 'PendingRefund'), /<button>Xác minh<\/button>/);
});
