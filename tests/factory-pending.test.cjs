const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function all(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  return [...(predicate(node) ? [node] : []), ...[node.props?.children].flat(Infinity).flatMap(child => all(child, predicate))];
}
function load(mocks) {
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/features/warehouse-work/FactoryPending.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new Function('require', 'exports', code)(name => mocks[name] ?? require(name), mod.exports);
  return mod.exports;
}
function render(warehouses, items, filter = '', admin = false) {
  let index = 0;
  const { FactoryPending } = load({
    react: { useState: init => [init, () => {}] },
    '@/shared/ui': { Card: 'card', QueryState: 'query', SimpleTable: 'table', ConfirmDialog: 'confirm-dialog' },
    '@/shared/lib/dates': { formatDate: x => x, formatInstantDateTime: x => x },
    '@/shared/router/listState': { useStringParam: () => [[filter, ''][index++], () => {}] },
  });
  const tree = FactoryPending({ warehouses, query: { data: items }, admin, busy: false, onOpen() {}, refresh() {} });
  return { tree, table: all(tree, n => n.type === 'query')[0].props.children() };
}
const pallet = (code, cartonCount = 10) => ({ palletId: code, palletCode: code, sku: 'SKU', productName: 'Sữa', batchCode: 'BID-1', cartonCount, expirationDate: '2026-12-31' });
const dispatch = (code, warehouse, pallets, extra = {}) => ({
  key: code, dispatchNoteId: code, dispatchCode: code, destinationWarehouseId: warehouse, dispatchedAt: null,
  vehicleNumber: '59C-123.45', driverName: 'Tài xế Ba', pallets, receiptDocumentId: null, ...extra,
});

test('one assigned warehouse has a fixed warehouse label and excludes other warehouses from pending dispatches', () => {
  const { tree, table } = render([{ id: 'W1', name: 'Kho A' }], [
    dispatch('PXN-1', 'W1', [pallet('P1')]), dispatch('PXN-2', 'W2', [pallet('P2')]),
  ]);
  assert.equal(all(tree, n => n.type === 'select').filter(select =>
    JSON.stringify(select).includes('Tất cả kho được phân công')).length, 0);
  assert.deepEqual(table.props.rows.map(d => d.dispatchCode), ['PXN-1']);
});
test('multi-warehouse selector filters pending dispatches while retaining the factory destination', () => {
  const item = dispatch('PXN-2', 'W2', [pallet('P2')]);
  const { tree, table } = render([{ id: 'W1', name: 'Kho A' }, { id: 'W2', name: 'Kho B' }], [dispatch('PXN-1', 'W1', [pallet('P1')]), item], 'W2');
  assert.equal(all(tree, n => n.type === 'select').filter(select =>
    JSON.stringify(select).includes('Tất cả kho được phân công')).length, 1);
  assert.deepEqual(table.props.rows, [item]);
});
test('a remembered filter for a revoked warehouse does not hide arrivals at the sole assigned warehouse', () => {
  const { table } = render([{ id: 'W1', name: 'Kho A' }], [dispatch('PXN-1', 'W1', [pallet('P1')])], 'W2');
  assert.deepEqual(table.props.rows.map(d => d.dispatchCode), ['PXN-1']);
});
test('a dispatch note with two pallets is one row listing both pallets, vehicle and driver', () => {
  const row = dispatch('PXN-1', 'W1', [pallet('PID-1', 10), pallet('PID-2', 12)]);
  const { table } = render([{ id: 'W1', name: 'Kho A' }], [row]);
  assert.equal(table.props.rows.length, 1);
  const palletCell = table.props.columns.find(c => c.header === 'Pallet cần nhận').cell(row);
  const text = JSON.stringify(palletCell);
  assert.ok(text.includes('2 pallet · 22 thùng'));
  assert.ok(text.includes('PID-1') && text.includes('PID-2'));
  assert.equal(table.props.columns.find(c => c.header === 'Xe / tài xế').cell(row), '59C-123.45 · Tài xế Ba');
});
test('search matches any pallet code of a dispatch note', () => {
  let index = 0;
  const { FactoryPending } = load({
    react: { useState: init => [init, () => {}] },
    '@/shared/ui': { Card: 'card', QueryState: 'query', SimpleTable: 'table', ConfirmDialog: 'confirm-dialog' },
    '@/shared/lib/dates': { formatDate: x => x, formatInstantDateTime: x => x },
    '@/shared/router/listState': { useStringParam: () => [['', 'pid-2'][index++], () => {}] },
  });
  const tree = FactoryPending({ warehouses: [{ id: 'W1', name: 'Kho A' }], query: { data: [dispatch('PXN-1', 'W1', [pallet('PID-1'), pallet('PID-2')]), dispatch('PXN-3', 'W1', [pallet('PID-3')])] }, admin: false, busy: false, onOpen() {}, refresh() {} });
  const table = all(tree, n => n.type === 'query')[0].props.children();
  assert.deepEqual(table.props.rows.map(d => d.dispatchCode), ['PXN-1']);
});
test('admin observes unstarted arrivals and only opens an existing receipt', () => {
  const { table } = render([{ id: 'W1', name: 'Kho A' }], [], '', true);
  const actions = table.props.columns.at(-1);
  assert.equal(actions.cell(dispatch('PXN-1', 'W1', [], { receiptDocumentId: null })), 'Chờ thủ kho kiểm đếm');
  assert.equal(actions.cell(dispatch('PXN-1', 'W1', [], { receiptDocumentId: 'R1' })).props.children, 'Xem tiến độ kiểm đếm');
});
test('keeper opens one receipt for the whole dispatch note after explicit confirmation', () => {
  let modalState = null;
  const opened = [];
  const row = dispatch('PXN-1', 'W1', [pallet('PID-1'), pallet('PID-2')]);
  let paramIndex = 0;
  const { FactoryPending } = load({
    react: { useState: () => [modalState, v => { modalState = v; }] },
    '@/shared/ui': { Card: 'card', QueryState: 'query', SimpleTable: 'table', ConfirmDialog: 'confirm-dialog' },
    '@/shared/lib/dates': { formatDate: x => x, formatInstantDateTime: x => x },
    '@/shared/router/listState': { useStringParam: () => [['', ''][paramIndex++], () => {}] },
  });
  const props = { warehouses: [{ id: 'W1', name: 'Kho A' }], query: { data: [row] }, admin: false, busy: false, onOpen(d) { opened.push(d); }, refresh() {} };
  const table = all(FactoryPending(props), n => n.type === 'query')[0].props.children();
  const btn = table.props.columns.at(-1).cell(row);
  assert.equal(btn.props.children, 'Bắt đầu kiểm đếm');
  btn.props.onClick();
  assert.equal(modalState, row);
  paramIndex = 0;
  const dialog = all(FactoryPending(props), n => n.type === 'confirm-dialog')[0];
  assert.equal(dialog.props.title, 'Xác nhận mở phiếu nhập kho');
  assert.ok(JSON.stringify(dialog.props.message).includes('PID-1, PID-2'));
  dialog.props.onConfirm();
  assert.deepEqual(opened, [row]);
});
