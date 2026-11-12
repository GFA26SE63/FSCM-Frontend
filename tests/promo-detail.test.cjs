const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function load(file, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), module, module.exports);
  return module.exports;
}

test('promotion detail fetches each selected product, including inactive and rule-only IDs, without list paging', async () => {
  const calls = [];
  const { promoApi } = load('features/promos/api.ts', { '@/shared/api/http': {
    get: async url => { calls.push(url); return { id: url.split('/').at(-1), status: 'Inactive' }; },
  } });
  const rows = await promoApi.appliedProducts({ productIds: ['beyond-page-one', 'beyond-page-one'], productRules: [{ productId: 'rule-only' }] });
  assert.deepEqual(calls, ['/products/beyond-page-one', '/products/rule-only']);
  assert.equal(rows.length, 2);
  assert.ok(rows.every(row => row.status === 'Inactive'));
});

test('selected customer scope uses exact IDs and does not broaden to all retailers on a lookup failure', async () => {
  const calls = [];
  const forbidden = new Error('Forbidden');
  const { promoApi } = load('features/promos/api.ts', { '@/shared/api/http': {
    get: async url => { calls.push(url); if (url.endsWith('/restricted')) throw forbidden; return { id: 'r1', contactName: 'Contact', status: 'Inactive' }; },
  } });
  assert.equal((await promoApi.appliedRetailers(['r1']))[0].contactName, 'Contact');
  await assert.rejects(promoApi.appliedRetailers(['restricted']), error => error === forbidden);
  assert.deepEqual(calls, ['/retailers/r1', '/retailers/restricted']);
});

test('all-customer scope and promotion pickers load every page using the real pageSize parameter', async () => {
  const calls = [];
  const { promoApi } = load('features/promos/api.ts', { '@/shared/api/http': {
    get: async (url, params) => { calls.push({ url, params }); return { totalCount: 3,
      items: params.page === 1 ? [{ id: '1' }, { id: '2' }] : [{ id: '3' }] }; },
  } });
  assert.equal((await promoApi.appliedRetailers([])).length, 3);
  assert.deepEqual(calls.map(call => call.params), [
    { status: 'Active', page: 1, pageSize: 100 }, { status: 'Active', page: 2, pageSize: 100 },
  ]);
  calls.length = 0;
  assert.equal((await promoApi.products()).length, 3);
  assert.deepEqual(calls.map(call => call.params.page), [1, 2]);
  assert.ok(calls.every(call => !('size' in call.params)));
});

test('lookup pagination detects repeated or incomplete pages instead of silently returning a partial list', async () => {
  for (const second of [[{ id: '1' }], []]) {
    const { promoApi } = load('features/promos/api.ts', { '@/shared/api/http': {
      get: async (_, params) => ({ totalCount: 2, items: params.page === 1 ? [{ id: '1' }] : second }),
    } });
    await assert.rejects(promoApi.retailers(), /Vui lòng tải lại/);
  }
});

const products = [
  { id: 'p1', sku: 'SKU001', name: 'Sữa tươi', categoryName: 'Sữa', unit: 'Thùng', status: 'Published' },
  { id: 'p2', sku: 'SKU002', name: 'Sữa chua', categoryName: 'Sữa', unit: 'Thùng', status: 'Inactive' },
];
const customers = [{ id: 'r1', code: '10004127', name: 'An Phú', contactName: 'Nguyễn An',
  phone: '0901000006', email: 'shop@example.test', address: 'Địa chỉ cửa hàng', salesGroupCode: 'HCM-A', creditTermDays: 14, status: 'Active' }];
const promotion = { id: 'promo', code: 'KM-001', name: 'Demo', campaignMode: 'ProductGroup', isActive: true,
  minimumQuantity: 10, discountPercent: 50, startAt: '2026-11-12T00:00:00Z', endAt: '2026-12-13T00:00:00Z',
  productIds: ['p1', 'p2'], categoryIds: [], retailerIds: ['r1'] };

function renderDetail(p = promotion, overrides = {}) {
  const tables = [];
  const actions = [];
  const targets = Object.fromEntries(Object.entries({ products, retailers: customers, categories: [] }).map(([key, data]) =>
    [key, { data, refetch() {}, ...overrides[key] }]));
  const wrap = ({ title, children, actions: buttons }) => React.createElement('section', null, title, buttons, children);
  const { PromoDetailPage } = load('features/promos/pages/PromoDetailPage.tsx', {
    '@/shared/router/compat': { useParams: () => ({ id: p.id }) },
    '../hooks': { usePromo: () => ({ data: p }), usePromoTargets: () => targets,
      usePausePromo: () => ({}), useActivatePromo: () => ({}) },
    '../status': { promoStatus: () => 'Running' },
    '@/shared/lib': { ...load('shared/lib/format.ts'), ...load('shared/lib/dates.ts'), statusLabel: (_, value) => value },
    '@/shared/ui': {
      QueryState: ({ query, children }) => children(query.data), Card: wrap, PageHeader: wrap,
      Callout: ({ children }) => React.createElement('p', null, children), StatusChip: () => null,
      Fields: ({ items }) => React.createElement('dl', null, items.map(item => React.createElement('div', { key: item.label }, item.label, ': ', item.value))),
      Button: props => { actions.push(props); return React.createElement('button', null, props.children); },
      DataTable: props => {
        tables.push(props);
        return React.createElement('table', null,
          React.createElement('thead', null, React.createElement('tr', null, props.columns.map(c => React.createElement('th', { key: c.key }, c.header)))),
          React.createElement('tbody', null, (props.rows ?? []).map(row => React.createElement('tr', { key: row.id },
            props.columns.map(c => React.createElement('td', { key: c.key }, c.text ? c.text(row) : row[c.key]))))));
      },
    },
  });
  return { html: renderToStaticMarkup(React.createElement(PromoDetailPage)), tables, actions };
}

test('detail presents separate searchable product/customer tables with full customer fields and inactive selected products', () => {
  const { html, tables } = renderDetail();
  assert.equal(tables.length, 2);
  assert.equal(tables[0].rows.length, 2);
  assert.ok(tables.every(table => table.pageSize === 5 && table.searchPlaceholder));
  for (const value of ['SKU001', 'SKU002', 'Sữa tươi', 'Sữa chua', 'Thùng', 'Inactive', '10004127', 'Nguyễn An',
    '0901000006', 'shop@example.test', 'Địa chỉ cửa hàng', 'HCM-A', '14 ngày']) assert.ok(html.includes(value), value);
  assert.ok(!html.includes('SKU001 · Sữa tươi, SKU002'));
  assert.ok(html.includes('Tổng số lượng tối thiểu của nhóm'));
});

test('per-SKU detail renders each saved rule rather than the shared group threshold', () => {
  const { tables, html } = renderDetail({ ...promotion, campaignMode: 'PerSku', productRules: [
    { productId: 'p1', minimumQuantity: 10, discountPercent: 5 },
    { productId: 'p2', minimumQuantity: 30, discountPercent: 7 },
  ] });
  const minimum = tables[0].columns.find(c => c.key === 'minimumQuantity');
  const discount = tables[0].columns.find(c => c.key === 'discountPercent');
  assert.equal(minimum.text(products[1]), '30');
  assert.equal(discount.text(products[1]), '7%');
  assert.ok(!html.includes('Tổng số lượng tối thiểu của nhóm'));
});

test('single-SKU legacy response displays its saved threshold and discount without needing campaignMode', () => {
  const { tables, html } = renderDetail({ ...promotion, campaignMode: undefined, productIds: ['p1'], minimumQuantity: 42, discountPercent: 9 });
  assert.equal(tables[0].columns.find(c => c.key === 'minimumQuantity').text(products[0]), '42');
  assert.equal(tables[0].columns.find(c => c.key === 'discountPercent').text(products[0]), '9%');
  assert.ok(!html.includes('Tổng số lượng tối thiểu của nhóm'));
});

test('all-customer scope stays explicit, while failed detail lookups hide stale rows and can be retried', () => {
  const all = renderDetail({ ...promotion, retailerIds: [] });
  assert.ok(all.html.includes('tất cả cửa hàng đủ điều kiện'));
  assert.equal(all.tables[1].rows.length, 1);
  let retries = 0;
  const error = new Error('offline');
  const failed = renderDetail(promotion, { retailers: { error, refetch: () => { retries++; } } });
  assert.equal(failed.tables[1].error, error);
  assert.equal(failed.tables[1].rows, undefined);
  failed.actions.find(action => action.children === 'Tải lại khách hàng').onClick();
  assert.equal(retries, 1);
});
