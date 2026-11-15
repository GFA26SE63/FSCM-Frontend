const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { matchPath } = require('react-router-dom');

function source(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', output)((name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith('.') || name.startsWith('@/')) throw new Error('Missing mock: ' + name);
    return require(name);
  }, module, module.exports);
  return module.exports;
}
const errors = source('shared/api/errors.ts');
const fixture = {
  id: 'p1', sku: 'SKU001', name: 'Milk', unit: 'Thùng', productCategoryId: 'c1',
  categoryName: 'Dairy', categoryCode: 'CAT-01', status: 'Draft',
  shelfLifeHours: 720, nearDateThresholdHours: 120, currentUnitPrice: 250000,
};
const fields = { productCategoryId: 'c1', name: 'Milk', unit: 'Thùng', shelfLifeHours: 720, nearDateThresholdHours: 120 };

test('Published and Inactive never expose edit/price actions; Draft links to edit page', () => {
  const { ProductActions } = source('features/products/components/ProductActions.tsx', {
    '@/shared/auth/AuthContext': { useAuth: () => ({ user: { role: 'Admin' } }) },
    '@/shared/auth/permissions': { can: () => true },
    '@/shared/api/errors': errors,
    '@/shared/router/compat': { useNavigate: () => () => {} },
    '@/shared/ui': {
      Button: ({ children }) => React.createElement('button', null, children), ConfirmDialog: () => null,
    },
    '../hooks': { useDeleteProduct: () => ({}), useInactivateProduct: () => ({}), usePublishProduct: () => ({}) },
  });
  const render = (status) => renderToStaticMarkup(React.createElement(ProductActions, { p: { ...fixture, status } }));
  assert.match(render('Draft'), /Sửa nháp \/ giá/);
  assert.ok(!render('Published').includes('Sửa nháp'));
  assert.match(render('Published'), /Tạo bản mới/);
  assert.match(render('Inactive'), /Tạo bản mới/);
  assert.ok(!render('Inactive').includes('Tạo bản thay thế'));
  assert.match(render('Published'), /Tạo bản thay thế/);
});

test('create/edit/clone/new-version routes are explicit and precede product details', () => {
  const { APP_ROUTES } = source('app/routes.tsx');
  const routes = APP_ROUTES.find((r) => r.key === 'skus').sub;
  for (const [url, expected] of [
    ['/skus/new', 'new'], ['/skus/p1/edit', ':sku/edit'],
    ['/skus/p1/new-version', ':sku/new-version'], ['/skus/p1', ':sku'],
    ['/skus/p1/clone', ':sku/clone'],
  ]) {
    const matched = routes.find((r) => matchPath(url, { path: '/skus/' + r.path, exact: true }));
    assert.equal(matched.path, expected);
  }
});

test('price API rejects stale Published/Inactive products without sending a price write', async () => {
  let writes = 0;
  let status = 'Published';
  const { productApi } = source('features/products/api.ts', {
    '@/shared/api/errors': errors,
    '@/shared/api/http': {
      get: async () => ({ ...fixture, status }),
      post: async () => { writes += 1; }, del() {}, put() {},
    },
  });
  await assert.rejects(productApi.setPrice({ id: 'p1', unitPrice: 260000 }), { status: 409 });
  status = 'Inactive';
  await assert.rejects(productApi.setPrice({ id: 'p1', unitPrice: 260000 }), { status: 409 });
  assert.equal(writes, 0);
  status = 'Draft';
  await productApi.setPrice({ id: 'p1', unitPrice: 260000 });
  assert.equal(writes, 1);
});

test('new version uses replacement contract instead of independent clone', async () => {
  let request;
  const { productApi } = source('features/products/api.ts', {
    '@/shared/api/errors': errors,
    '@/shared/api/http': { post: async (url, payload) => { request = { url, payload }; }, get() {}, del() {}, put() {} },
  });
  const payload = { sku: 'SKU002', name: 'New Milk', unit: 'Thùng', shelfLifeHours: 720, nearDateThresholdHours: 120, initialUnitPrice: 260000 };
  await productApi.replacement({ id: 'p1', ...payload });
  assert.deepEqual(request, { url: '/products/p1/replacement', payload });
});

test('independent clone sends edited master data and price in one clone request', async () => {
  const requests = [];
  const { productApi } = source('features/products/api.ts', {
    '@/shared/api/errors': errors,
    '@/shared/api/http': {
      post: async (url, payload) => { requests.push({ url, payload }); return { ...fixture, ...payload, id: 'p2', status: 'Draft', replacesProductId: null }; },
      get() { throw new Error('Clone must not require a second read'); },
      put() { throw new Error('Clone must not update the source'); },
      del() {},
    },
  });
  const payload = { ...fields, sku: 'SKU002', productCategoryId: 'c2', name: 'Cloned milk', initialUnitPrice: 260000 };
  const result = await productApi.clone({ id: 'p1', ...payload });
  assert.deepEqual(requests, [{ url: '/products/p1/clone', payload }]);
  assert.equal(result.id, 'p2');
  assert.equal(result.status, 'Draft');
  assert.equal(result.replacesProductId, null);
});

test('retry after partial save does not repeat successful metadata updates or duplicate a draft', async () => {
  let current = { ...fixture };
  let updates = 0;
  let failPrice = true;
  const { saveProductDraft } = source('features/products/saveDraft.ts', {
    '@/shared/api/errors': errors,
    './api': { productApi: {
      get: async () => current,
      update: async ({ id, ...input }) => { updates += 1; current = { ...current, ...input }; return current; },
      setPrice: async () => { if (failPrice) throw new errors.ApiError(503, 'Unavailable'); },
    } },
  });
  const input = { ...fields, id: 'p1', name: 'Updated Milk', unitPrice: 260000 };
  await assert.rejects(saveProductDraft(input), (error) => error.detail.includes('Thông tin sản phẩm đã lưu'));
  assert.equal(updates, 1);
  failPrice = false;
  assert.equal((await saveProductDraft(input)).currentUnitPrice, 260000);
  assert.equal(updates, 1);
  current.status = 'Published';
  await assert.rejects(saveProductDraft(input), { status: 409 });
  assert.equal(updates, 1);
});

test('new-version form is a full page prefilled from source; Published edit URL stays blocked', () => {
  const utils = source('features/products/utils.ts', { '@/shared/api/errors': errors });
  const Wrapper = ({ children }) => React.createElement('section', null, children);
  let sourceStatus = 'Published';
  const { ProductReplacementPage, ProductEditPage, ProductCreatePage, ProductClonePage } = source('features/products/pages/ProductFormPage.tsx', {
    '@tanstack/react-query': { useQueryClient: () => ({}) },
    '@/shared/auth/AuthContext': { useAuth: () => ({ user: { role: 'Admin' } }) },
    '@/shared/auth/permissions': { can: () => true, assertPermission() {} },
    '@/shared/router/compat': { useParams: () => ({ sku: 'p1' }), useNavigate: () => () => {} },
    '@/shared/ui': {
      Button: ({ children }) => React.createElement('button', null, children), Callout: Wrapper, Card: Wrapper, FormField: Wrapper,
      Input: (props) => React.createElement('input', props), Select: () => React.createElement('select'),
      PageHeader: ({ title }) => React.createElement('h1', null, title),
      QueryState: ({ query, children }) => children(query.data),
    },
    '../hooks': {
      useProduct: () => ({ data: { ...fixture, status: sourceStatus } }),
      useCategoryOptions: () => ({ data: [{ id: 'c1', code: 'CAT-01', name: 'Dairy', isActive: true }] }),
      useCreateProduct: () => ({}), useCreateReplacement: () => ({}), useCloneProduct: () => ({}), useSaveProductDraft: () => ({}),
    },
    '../utils': utils,
  });
  const html = renderToStaticMarkup(React.createElement(ProductReplacementPage));
  assert.match(html, /<form/);
  assert.match(html, /value="Milk"/);
  assert.match(html, /value="250000"/);
  assert.match(html, /value="30"/);
  assert.ok(!html.includes('role="dialog"'));
  const blocked = renderToStaticMarkup(React.createElement(ProductEditPage));
  assert.ok(!blocked.includes('<form'));
  assert.match(blocked, /Không thể mở form/);
  assert.match(renderToStaticMarkup(React.createElement(ProductCreatePage)), /<form/);
  for (sourceStatus of ['Draft', 'Published', 'Inactive']) {
    const clone = renderToStaticMarkup(React.createElement(ProductClonePage));
    assert.match(clone, /<form/);
    assert.match(clone, /value="Milk"/);
    assert.match(clone, /value="250000"/);
    assert.match(clone, /value="30"/);
    assert.match(clone, /value=""/);
    assert.match(clone, /bản nháp độc lập/);
    assert.ok(!clone.includes('khi đăng bán bản mới, bản nguồn sẽ ngừng bán'));
  }
});
