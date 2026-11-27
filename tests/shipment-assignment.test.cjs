const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const mocks = {
  '@/shared/auth/permissions': { hasOperation: (user, key) => user?.permissions?.includes(key) === true },
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
  '@/shared/api/errors': { errorMessage: error => String(error?.message ?? error ?? '') },
  '@/features/runpicking/hooks': {},
  '../hooks': {},
  '../api': { shipmentsApi: {} },
  '../types': { HAS_LEFT: [] },
};
const filename = path.resolve(__dirname, '../src/features/shipments/components/ShipmentOperations.tsx');
const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const mod = { exports: {} };
new Function('require', 'exports', 'module', code)(name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), mod.exports, mod);
const shipment = { id: 'shipment', warehouseId: 'warehouse-a', status: 'Issued', totalQuantity: 60, driverId: null };
const driver = { id: 'driver', warehouseId: 'warehouse-a', fullName: 'Correct driver', code: 'D1', isActive: true };
const vehicle = { id: 'vehicle', warehouseId: 'warehouse-a', plateNumber: 'ENOUGH', capacity: 60, isActive: true };
const render = (drivers, vehicles) => renderToStaticMarkup(React.createElement(mod.exports.ShipmentActionRow, { shipment, mayDispatch: true, drivers, vehicles }));

test('assignment waits for confirmation, cancellation sends nothing, and confirmation uses the displayed selection', async () => {
  const slots = [];
  let cursor = 0;
  const calls = [];
  const ConfirmDialog = () => null;
  const local = { exports: {} };
  const overrides = {
    ...mocks,
    react: { ...React, useState: initial => {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], value => { slots[index] = value; }];
    } },
    '@/shared/ui': { ...mocks['@/shared/ui'], ConfirmDialog },
    '@/shared/hooks/useApiMutation': { useApiMutation: fn => ({ mutateAsync: fn, isPending: false }) },
    '../api': { shipmentsApi: { assign: async input => { calls.push(input); return input.shipment; } } },
  };
  new Function('require', 'exports', 'module', code)(name => Object.hasOwn(overrides, name) ? overrides[name] : require(name), local.exports, local);
  const tree = () => { cursor = 0; return local.exports.ShipmentActionRow({ shipment, mayDispatch: true, mayStartDelivery: false, drivers: [driver], vehicles: [vehicle] }); };
  function find(node, predicate) {
    if (!React.isValidElement(node)) return null;
    if (predicate(node)) return node;
    return React.Children.toArray(node.props.children).map(child => find(child, predicate)).find(Boolean);
  }
  const assignButton = () => find(tree(), node => node.props.children === 'Gán xe & tài xế');
  assignButton().props.onClick();
  assert.equal(calls.length, 0);
  let dialog = find(tree(), node => node.type === ConfirmDialog);
  const message = renderToStaticMarkup(dialog.props.message);
  assert.match(message, /Correct driver/);
  assert.match(message, /ENOUGH/);
  dialog.props.onClose();
  assert.equal(calls.length, 0);
  assert.equal(find(tree(), node => node.type === ConfirmDialog), undefined);
  assignButton().props.onClick();
  dialog = find(tree(), node => node.type === ConfirmDialog);
  await dialog.props.onConfirm();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].driverId, driver.id);
  assert.equal(calls[0].vehicleId, vehicle.id);
  assert.equal(find(tree(), node => node.type === ConfirmDialog), undefined);
});

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

test('assignment waits until active transport assignments are loaded', () => {
  const html = renderToStaticMarkup(React.createElement(mod.exports.ShipmentActionRow, {
    shipment,
    mayDispatch: true,
    drivers: [driver],
    vehicles: [vehicle],
    assignmentLoaded: false,
  }));
  assert.match(html, /<button disabled/);
});

test('a driver from another warehouse cannot enable assignment', () => {
  const html = render([{ ...driver, warehouseId: 'warehouse-b' }], [vehicle]);
  assert.match(html, /<button disabled/);
  assert.doesNotMatch(html, /Correct driver/);
});

test('exception shipments are read-only in dispatch for both operators and readers', () => {
  const props = { shipment: { ...shipment, status: 'Exception', exceptionReason: 'Missing carton' }, drivers: [], vehicles: [] };
  const operator = renderToStaticMarkup(React.createElement(mod.exports.ShipmentActionRow, { ...props, mayDispatch: true }));
  assert.match(operator, /Ngoại lệ/);
  assert.doesNotMatch(operator, /Hoàn tất xử lý ngoại lệ|Kết quả xử lý|Missing carton|<input|<button/);
  const reader = renderToStaticMarkup(React.createElement(mod.exports.ShipmentActionRow, { ...props, mayDispatch: false }));
  assert.doesNotMatch(reader, /Hoàn tất xử lý ngoại lệ/);
});

test('an issued assigned shipment can start delivery even after the order left the warehouse', () => {
  const props = { shipment: { ...shipment, status: 'Issued', driverId: 'driver', vehicleId: 'vehicle' }, drivers: [driver], vehicles: [vehicle] };
  const operator = renderToStaticMarkup(React.createElement(mod.exports.ShipmentActionRow, { ...props, mayDispatch: true }));
  assert.match(operator, /Bắt đầu giao/);
  assert.match(operator, /Cập nhật xe &amp; tài xế/);
  const keeper = renderToStaticMarkup(React.createElement(mod.exports.ShipmentActionRow, { ...props, mayDispatch: false }));
  assert.doesNotMatch(keeper, /Bắt đầu giao/);
  for (const status of ['Delivering', 'Received']) {
    const html = renderToStaticMarkup(React.createElement(mod.exports.ShipmentActionRow, { ...props, shipment: { ...props.shipment, status }, mayDispatch: true }));
    assert.doesNotMatch(html, /Bắt đầu giao|Xác nhận xuất kho|Gán xe/);
  }
});

test('keeper can start an assigned trip without assignment or exception-management controls', () => {
  const props = {
    shipment: { ...shipment, status: 'Issued', driverId: 'driver', vehicleId: 'vehicle' },
    drivers: [], vehicles: [], mayDispatch: false, mayStartDelivery: true,
  };
  const html = renderToStaticMarkup(React.createElement(mod.exports.ShipmentActionRow, props));
  assert.match(html, /Bắt đầu giao/);
  assert.doesNotMatch(html, /Gán xe|Cập nhật xe|Hoàn tất xử lý ngoại lệ/);
  const foreign = renderToStaticMarkup(React.createElement(mod.exports.ShipmentActionRow, { ...props, mayStartDelivery: false }));
  assert.doesNotMatch(foreign, /Bắt đầu giao/);
  const unassigned = renderToStaticMarkup(React.createElement(mod.exports.ShipmentActionRow, {
    ...props, shipment: { ...props.shipment, driverId: null },
  }));
  assert.doesNotMatch(unassigned, /Bắt đầu giao/);
});

test('assigning an issued shipment starts delivery using the returned version', async () => {
  const captured = [];
  const calls = [];
  const original = mocks['@/shared/hooks/useApiMutation'].useApiMutation;
  mocks['@/shared/hooks/useApiMutation'].useApiMutation = fn => { if (typeof fn === 'function') captured.push(fn); return { mutate() {}, isPending: false }; };
  mocks['../api'].shipmentsApi.assign = async () => { calls.push('assign'); return { ...shipment, version: 8, status: 'Issued' }; };
  mocks['../api'].shipmentsApi.dispatch = async assigned => { calls.push(['dispatch', assigned.version]); return { ...assigned, status: 'Delivering' }; };
  try {
    render([driver], [vehicle]);
    const result = await captured[0]({ shipment, driverId: driver.id, vehicleId: vehicle.id });
    assert.equal(result.status, 'Delivering');
    assert.deepEqual(calls, ['assign', ['dispatch', 8]]);
  } finally {
    mocks['@/shared/hooks/useApiMutation'].useApiMutation = original;
    delete mocks['../api'].shipmentsApi.assign;
    delete mocks['../api'].shipmentsApi.dispatch;
  }
});
