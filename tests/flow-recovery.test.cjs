const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function load(file, mocks) {
  const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../src', file), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'exports', 'module', code)(name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), mod.exports, mod);
  return mod.exports;
}

test('configuration reads versioned keys and saves supported values in backend units', async () => {
  const calls = [];
  const { configApi } = load('features/config/api.ts', { '@/shared/api/http': {
    get: async url => { assert.equal(url, '/configurations'); return [
      { key: 'allocation.weights', value: { expiry: .7, distance: .2, coverage: .1 } },
      { key: 'allocation.service_radius_meters', value: 35000 },
      { key: 'order.order_step_cartons', value: 2 }, { key: 'mlor.default_ratio', value: .4 },
    ]; }, put: async (url, body) => calls.push({ url, body }),
  } });
  const settings = await configApi.settings();
  assert.equal(settings.dmaxRetailerKm, 35);
  assert.deepEqual(settings.allocation, { wE: .7, wD: .2, wQ: .1 });
  await configApi.saveSettings(settings);
  assert.deepEqual(calls.map(c => c.url), ['/configurations/allocation.weights', '/configurations/allocation.service_radius_meters', '/configurations/order.order_step_cartons', '/configurations/mlor.default_ratio']);
  assert.equal(calls[1].body.value, 35000);
  assert.equal(calls[3].body.value, .4);
});

test('shipment exception resolution sends current version and a trimmed result', async () => {
  const calls = [];
  const { shipmentsApi } = load('features/shipments/api.ts', { '@/shared/api/http': {
    post: async (url, body) => calls.push({ url, body }),
  } });
  await shipmentsApi.resolveException({ shipment: { id: 'part', version: 7 }, reason: '  Settled shortage  ' });
  assert.deepEqual(calls, [{ url: '/shipments/part/exception/resolve', body: { reason: 'Settled shortage', expectedVersion: 7 } }]);
});

test('allocation explanation shows rejected candidates and per-iteration scores from saved audit', () => {
  const Container = ({ children }) => React.createElement('div', null, children);
  const { AllocationTraceDialog } = load('features/orders/components/AllocationTraceDialog.tsx', {
    '@/shared/ui': { Modal: Container, Callout: Container, Chip: Container, Tabs: () => null,
      SimpleTable: ({ rows, columns }) => React.createElement('div', null, rows.map((row, i) =>
        React.createElement('div', { key: i }, columns.map((c, j) => React.createElement('span', { key: j }, c.cell(row)))))),
    }, '@/shared/lib': { formatDateTime: v => v ?? '—', formatHours: String, formatMoney: String, formatNumber: String, formatPercent: String },
  });
  const html = renderToStaticMarkup(React.createElement(AllocationTraceDialog, { open: true, onClose() {}, order: {
    orderCode: 'DH-001024', lines: [{ id: 'line', sku: 'SKU001', quantity: 10, allocationFragments: [], mlor: { sourceScope: 'Default', minimumLifeRatio: .25, minimumLifeHours: 42, sourceVersion: 1 } }],
    allocationAudit: { weights: { shelfLife: .7, distance: .2, coverage: .1, maximumDistanceMeters: 35000 }, lines: [
      { lineId: 'line', filters: [{ warehouseCode: 'WH-A', batchCode: 'REJECTED-BATCH', stage: 'Delivery', passed: false, reason: 'BelowMlor', estimatedArrivalAt: 'ETA', remainingShelfLifeHours: 20, requiredShelfLifeHours: 42 }],
        scores: [{ iteration: 2, rank: 1, batchCode: 'SELECTED-BATCH', shelfLifeScore: .5, distanceScore: .4, coverageScore: 1, weightedScore: .53, selected: true, selectedQuantity: 4 }] },
    ] },
  } }));
  assert.match(html, /REJECTED-BATCH/);
  assert.match(html, /Không đạt MLOR tại ETA/);
  assert.match(html, /SELECTED-BATCH/);
  assert.match(html, /Cấp 4/);
  assert.match(html, /35 km/);
});
