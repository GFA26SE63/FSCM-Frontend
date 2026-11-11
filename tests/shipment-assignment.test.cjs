const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const mocks = {
  '@/shared/ui': {
    Button: ({ disabled, children }) => React.createElement('button', { disabled }, children),
    Select: ({ options, value, onChange }) => React.createElement('select', { value, onChange }, options.map(item => React.createElement('option', { key: item.value, value: item.value }, item.label))),
    Chip: ({ children }) => React.createElement('span', null, children),
    Input: props => React.createElement('input', props),
    Callout: ({ children }) => React.createElement('p', null, children),
  },
  '@/shared/lib': { formatNumber: value => String(value) },
  '@/shared/auth/AuthContext': {},
  '@/shared/hooks/useApiMutation': { useApiMutation: () => ({ mutate() {}, isPending: false }) },
  '@/features/runpicking/hooks': {},
  '../hooks': {},
  '../api': { shipmentsApi: {} },
  '../types': { HAS_LEFT: [] },
};
const filename = path.resolve(__dirname, '../src/features/shipments/pages/OrderReadinessPage.tsx');
const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const mod = { exports: {} };
new Function('require', 'exports', 'module', code)(name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), mod.exports, mod);
const shipment = { id: 'shipment', warehouseId: 'warehouse-a', status: 'Issued', totalQuantity: 60, driverId: null };
const driver = { id: 'driver', warehouseId: 'warehouse-a', fullName: 'Correct driver', code: 'D1', isActive: true };
const vehicle = { id: 'vehicle', warehouseId: 'warehouse-a', plateNumber: 'ENOUGH', capacity: 60, isActive: true };
const render = (drivers, vehicles) => renderToStaticMarkup(React.createElement(mod.exports.ShipmentActionRow, { shipment, mayDispatch: true, drivers, vehicles }));

test('assignment offers only active same-warehouse vehicles with enough capacity', () => {
  const html = render([driver], [vehicle, { ...vehicle, id: 'small', plateNumber: 'TOO-SMALL', capacity: 59 }, { ...vehicle, id: 'other', plateNumber: 'OTHER-WAREHOUSE', warehouseId: 'warehouse-b' }, { ...vehicle, id: 'inactive', plateNumber: 'INACTIVE', isActive: false }]);
  assert.match(html, /ENOUGH · 60 thùng/);
  assert.doesNotMatch(html, /TOO-SMALL|OTHER-WAREHOUSE|INACTIVE/);
  assert.doesNotMatch(html, /<button disabled/);
});

test('assignment is disabled when the warehouse has no suitable vehicle', () => {
  const html = render([driver], [{ ...vehicle, capacity: 59 }]);
  assert.match(html, /<button disabled/);
  assert.match(html, /chưa có xe đang hoạt động đủ tải/);
});

test('a driver from another warehouse cannot enable assignment', () => {
  const html = render([{ ...driver, warehouseId: 'warehouse-b' }], [vehicle]);
  assert.match(html, /<button disabled/);
  assert.doesNotMatch(html, /Correct driver/);
});

test('only operators see an exception resolution action and it needs a result', () => {
  const props = { shipment: { ...shipment, status: 'Exception', exceptionReason: 'Missing carton' }, drivers: [], vehicles: [] };
  const operator = renderToStaticMarkup(React.createElement(mod.exports.ShipmentActionRow, { ...props, mayDispatch: true }));
  assert.match(operator, /Hoàn tất xử lý ngoại lệ/);
  assert.match(operator, /Missing carton/);
  assert.match(operator, /<button disabled/);
  const reader = renderToStaticMarkup(React.createElement(mod.exports.ShipmentActionRow, { ...props, mayDispatch: false }));
  assert.doesNotMatch(reader, /Hoàn tất xử lý ngoại lệ/);
});
