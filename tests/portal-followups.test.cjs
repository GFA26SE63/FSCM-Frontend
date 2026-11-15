const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function source(file, mocks) {
  const filename = path.resolve(__dirname, '../src', file);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'exports', 'module', code)(name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith('.') || name.startsWith('@/')) throw new Error('Missing mock: ' + name);
    return require(name);
  }, mod.exports, mod);
  return mod.exports;
}

const { sortExportOrders, EXPORT_PAGE_SIZE, exportStatus } = source('features/shipments/exportList.ts', {
  './types': { HAS_LEFT: ['Issued', 'Delivering', 'Received'] },
});

test('newest export orders use creation time, not code; paging does not discard older orders', () => {
  const orders = Array.from({ length: 23 }, (_, i) => ({ id: String(i), orderCode: `DH-${100 - i}`, createdAt: new Date(Date.UTC(2026, 10, i + 1)).toISOString() }));
  const sorted = sortExportOrders(orders, 'newest');
  assert.equal(sorted[0].id, '22');
  assert.equal(sorted.at(-1).id, '0');
  assert.deepEqual([0, 1, 2].map(page => sorted.slice(page * EXPORT_PAGE_SIZE, (page + 1) * EXPORT_PAGE_SIZE).length), [10, 10, 3]);
  assert.equal(new Set(sorted.map(row => row.id)).size, 23);
  assert.equal(orders[0].id, '0');
  assert.equal(sortExportOrders(orders, 'oldest')[0].id, '0');
  assert.equal(sortExportOrders(orders, 'codeAsc')[0].orderCode, 'DH-78');
});

test('aggregate departed label is separate from individual shipment dispatch status', () => {
  const order = { isReady: true, hasException: false, parts: [{ status: 'Issued' }, { status: 'Delivering' }] };
  assert.equal(exportStatus(order).label, 'Đã rời kho');
  assert.equal(order.parts[0].status, 'Issued');
  assert.equal(exportStatus({ ...order, parts: [{ status: 'Ready' }] }).label, 'Được xuất');
  assert.equal(exportStatus({ ...order, isReady: false, hasException: true, parts: [{ status: 'Exception' }] }).label, 'Ngoại lệ');
});

test('export row opens a popup retaining warehouse, pending picking, payment and operation details', () => {
  let expanded = false;
  const ui = {
    Chip: ({ children }) => React.createElement('span', null, children),
    Callout: ({ children }) => React.createElement('div', null, children),
    Modal: ({ title, children }) => React.createElement('div', { role: 'dialog' }, title, children),
    SimpleTable: ({ rows, columns }) => React.createElement('div', null, rows.map((row, i) =>
      React.createElement('div', { key: i }, columns.map((col, j) => React.createElement('span', { key: j }, col.cell(row)))))),
  };
  const { ExportOrderCard } = source('features/shipments/components/ExportOrderCard.tsx', {
    react: { ...React, useState: () => [expanded, () => {}] },
    'lucide-react': { ChevronDown: () => null, ChevronRight: () => null },
    '@/shared/ui': ui,
    '../types': { HAS_LEFT: ['Issued', 'Delivering', 'Received'] },
    '../exportList': { exportStatus },
    './ShipmentOperations': { ShipmentOperations: () => React.createElement('div', null, 'shipment operations') },
  });
  const props = {
    order: { id: 'order', orderCode: 'DH-100' }, loading: false, failed: false, sort: 'asc', retry() {},
    readiness: { isReady: false, hasException: false, paymentSettled: false, blockingReasons: ['Warehouse B still picking'],
      parts: [ { warehouseCode: 'WH-A', shipmentCode: 'SHIP-1', status: 'Issued' }, { warehouseCode: 'WH-B', shipmentCode: null, status: 'WaitingToPick' } ] },
  };
  const render = () => renderToStaticMarkup(React.createElement(ExportOrderCard, props));
  assert.match(render(), /aria-haspopup="dialog"/);
  assert.doesNotMatch(render(), /role="dialog"|aria-expanded/);
  assert.match(render(), /DH-100/);
  assert.doesNotMatch(render(), /WH-A|WH-B|shipment operations/);
  expanded = true;
  const html = render();
  assert.match(html, /role="dialog"/);
  assert.match(html, /Chi tiết xuất kho · DH-100/);
  assert.doesNotMatch(html, /aria-expanded/);
  assert.match(html, /WH-A/);
  assert.match(html, /WH-B/);
  assert.match(html, /SHIP-1/);
  assert.match(html, /chưa có — kho chưa đóng phiếu soạn/);
  assert.match(html, /Warehouse B still picking/);
  assert.match(html, /chưa thanh toán đủ/);
  assert.match(html, /shipment operations/);
  assert.match(html, /không còn hủy được/);
});

test('export metadata requests lightweight scoped entities and refuses missing dates/orders', async () => {
  const calls = [];
  let response = { entities: { salesOrders: { nodes: [{ id: 'a', orderCode: 'DH-1', createdAt: '2026-11-12T00:00:00Z' }] } } };
  const { shipmentsApi } = source('features/shipments/api.ts', {
    '@/shared/api/http': {},
    '@/shared/api/graphql': { graphql: async (query, variables) => { calls.push({ query, variables }); return response; } },
    '@/shared/api/errors': { ApiError: class extends Error {} },
  });
  assert.equal((await shipmentsApi.exportOrders(['a', 'a'])).length, 1);
  assert.deepEqual(calls[0].variables.ids, ['a']);
  assert.match(calls[0].query, /entities\s*{\s*salesOrders/);
  assert.match(calls[0].query, /id orderCode createdAt/);
  await assert.rejects(shipmentsApi.exportOrders(['missing']));
  response = { entities: { salesOrders: { nodes: [{ id: 'a', orderCode: 'DH-1' }] } } };
  await assert.rejects(shipmentsApi.exportOrders(['a']));
});

function dialog(props, submit, latest = async () => []) {
  const { MlorRuleDialog } = source('features/retailers/components/MlorRuleDialog.tsx', {
    '@/shared/ui': { FormDialog() {} },
    '@/shared/api/errors': { ApiError: class extends Error {
      constructor(status, title, detail) { super(detail ?? title); this.status = status; }
    } },
    '../api': { retailerApi: { mlorConfigs: latest } },
    '../hooks': { useSetMlor: () => ({ mutateAsync: submit }) },
  });
  return MlorRuleDialog({ retailerId: 'retailer', configs: [], categories: [], products: [], onClose() {}, ...props }).props;
}

test('add offers only Category/SKU scopes without an active rule; existing scopes can still be edited', async () => {
  for (const scope of ['category', 'product']) {
    const key = scope === 'category' ? 'productCategoryId' : 'productId';
    const config = { [key]: 'existing', isActive: true, minimumLifeRatio: 0.25 };
    const props = { scope, configs: [config],
      categories: [{ id: 'existing', code: 'CAT-1' }, { id: 'new', code: 'CAT-2' }],
      products: [{ id: 'existing', sku: 'SKU001' }, { id: 'new', sku: 'SKU002' }],
    };
    const saved = [];
    const add = dialog(props, async payload => saved.push(payload));
    assert.deepEqual(add.fields[0].options.map(option => option.value), ['new']);
    assert.equal(add.initial[key], 'new');
    assert.ok(add.fields[0].validate('existing'));
    await add.onSubmit({ [key]: 'new', ratioPercent: 30, minimumLifeHours: '' });
    assert.equal(saved[0][key], 'new');
    const edit = dialog({ ...props, config }, async payload => saved.push(payload), async () => { throw new Error('Edit must not call create preflight'); });
    assert.equal(edit.fields[0].type, 'info');
    await edit.onSubmit({ [key]: 'other', ratioPercent: 40, minimumLifeHours: '' });
    assert.equal(saved[1][key], 'existing');
  }
});

test('add refuses a scope created after opening the form and does not mutate or close', async () => {
  let saves = 0;
  let closed = false;
  const form = dialog({ scope: 'category', categories: [{ id: 'cat', code: 'CAT-1' }], onClose: () => { closed = true; } },
    async () => { saves += 1; }, async () => [{ productCategoryId: 'cat', isActive: true }]);
  await assert.rejects(form.onSubmit({ productCategoryId: 'cat', ratioPercent: 30 }), { status: 409 });
  assert.equal(saves, 0);
  assert.equal(closed, false);
});

test('all occupied scopes show guidance without a submit form; inactive scopes may be added again', async () => {
  const { MlorRuleDialog } = source('features/retailers/components/MlorRuleDialog.tsx', {
    '@/shared/ui': { Modal() {}, Callout: ({ children }) => React.createElement('div', null, children), FormDialog() {} },
    '@/shared/api/errors': {}, '../api': {}, '../hooks': { useSetMlor: () => ({}) },
  });
  const props = { retailerId: 'retailer', scope: 'category', configs: [{ productCategoryId: 'cat', isActive: true }],
    categories: [{ id: 'cat', code: 'CAT-1' }], products: [], onClose() {} };
  const full = MlorRuleDialog(props);
  assert.equal(full.props.fields, undefined);
  const text = renderToStaticMarkup(full.props.children);
  assert.match(text, /Không còn danh mục chưa có yêu cầu HSD để thêm/);
  assert.match(text, /hãy dùng nút Sửa/);
  const available = dialog({ ...props, configs: [{ productCategoryId: 'cat', isActive: false }] }, async () => {});
  assert.equal(available.initial.productCategoryId, 'cat');
});

test('editing Category fixes scope, preloads ratio and never sends SKU-only hours', async () => {
  let payload;
  const form = dialog({ scope: 'category', config: { productCategoryId: 'cat', minimumLifeRatio: 0.25, minimumLifeHours: null } }, async value => { payload = value; });
  assert.equal(form.initial.ratioPercent, '25');
  assert.equal(form.fields[0].type, 'info');
  assert.ok(!form.fields.some(f => f.key === 'minimumLifeHours'));
  await form.onSubmit({ productCategoryId: 'other', ratioPercent: 35, minimumLifeHours: 42 });
  assert.deepEqual(payload, { retailerId: 'retailer', productCategoryId: 'cat', minimumLifeRatio: 0.35, minimumLifeHours: null });
});

test('SKU edit preserves zero hours, enforces bounds, and leaves dialog open on backend failure', async () => {
  let payload;
  let closed = false;
  const props = { scope: 'product', config: { productId: 'sku', minimumLifeRatio: 0.3, minimumLifeHours: 0 },
    products: [{ id: 'sku', shelfLifeHours: 168 }], onClose: () => { closed = true; } };
  const form = dialog(props, async value => { payload = value; });
  assert.equal(form.initial.minimumLifeHours, '0');
  const hours = form.fields.find(f => f.key === 'minimumLifeHours');
  assert.ok(hours.validate(-1, {}));
  assert.ok(hours.validate(169, {}));
  assert.ok(hours.validate(1.5, {}));
  assert.equal(hours.validate(0, {}), undefined);
  const ratio = form.fields.find(f => f.key === 'ratioPercent');
  for (const value of [0, 100, Infinity, 'abc']) assert.ok(ratio.validate(value));
  await form.onSubmit({ productId: 'wrong', ratioPercent: 40, minimumLifeHours: 0 });
  assert.equal(payload.productId, 'sku');
  assert.equal(payload.minimumLifeHours, 0);
  assert.equal(closed, true);
  closed = false;
  const failure = dialog(props, async () => { throw new Error('backend rejected'); });
  await assert.rejects(failure.onSubmit({ ratioPercent: 40, minimumLifeHours: '' }));
  assert.equal(closed, false);
});
