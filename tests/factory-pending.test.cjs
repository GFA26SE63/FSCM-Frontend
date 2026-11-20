const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function all(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  return [...(predicate(node) ? [node] : []), ...[node.props?.children].flat(Infinity).flatMap(child => all(child, predicate))];
}
function render(warehouses, items, filter = '', admin = false) {
  let index = 0;
  const mod = { exports: {} };
  const mocks = {
    react: { useState: init => [init, () => {}] },
    '@/shared/ui': { Card: 'card', QueryState: 'query', SimpleTable: 'table', ConfirmDialog: 'confirm-dialog' },
    '@/shared/lib/dates': { formatDate: x => x, formatInstantDateTime: x => x },
    '@/shared/router/listState': { useStringParam: () => [[filter, ''][index++], () => {}] },
  };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/features/warehouse-work/FactoryPending.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new Function('require', 'exports', code)(name => mocks[name] ?? require(name), mod.exports);
  const tree = mod.exports.FactoryPending({ warehouses, query: { data: items }, admin, busy: false, onOpen() {}, refresh() {} });
  return { tree, table: all(tree, n => n.type === 'query')[0].props.children() };
}

test('one assigned warehouse has a fixed warehouse label and excludes other warehouses from pending items', () => {
  const { tree, table } = render([{ id: 'W1', name: 'Kho A' }], [
    { palletCode: 'P1', destinationWarehouseId: 'W1' }, { palletCode: 'P2', destinationWarehouseId: 'W2' },
  ]);
  assert.equal(all(tree, n => n.type === 'select').length, 0);
  assert.deepEqual(table.props.rows.map(p => p.palletCode), ['P1']);
});

test('multi-warehouse selector filters pending pallets while retaining the factory destination', () => {
  const item = { palletCode: 'P2', destinationWarehouseId: 'W2' };
  const { tree, table } = render([{ id: 'W1', name: 'Kho A' }, { id: 'W2', name: 'Kho B' }], [
    { palletCode: 'P1', destinationWarehouseId: 'W1' }, item,
  ], 'W2');
  assert.equal(all(tree, n => n.type === 'select').length, 1);
  assert.deepEqual(table.props.rows, [item]);
  assert.equal(item.destinationWarehouseId, 'W2');
});

test('a remembered filter for a revoked warehouse does not hide arrivals at the sole assigned warehouse', () => {
  const { table } = render([{ id: 'W1', name: 'Kho A' }], [{ palletCode: 'P1', destinationWarehouseId: 'W1' }], 'W2');
  assert.deepEqual(table.props.rows.map(p => p.palletCode), ['P1']);
});

test('admin observes unstarted arrivals and only opens an existing receipt', () => {
  const { table } = render([{ id: 'W1', name: 'Kho A' }], [], '', true);
  const actions = table.props.columns.at(-1);
  assert.equal(actions.cell({ receiptDocumentId: null }), 'Chờ thủ kho kiểm đếm');
  assert.equal(actions.cell({ receiptDocumentId: 'R1' }).props.children, 'Xem tiến độ kiểm đếm');
});

test('keeper starts inspection after explicit confirmation in modal dialog', () => {
  let modalState = null;
  const opened = [];
  const pallet = { palletCode: 'P1', destinationWarehouseId: 'W1', receiptDocumentId: null };
  const mod = { exports: {} };
  let paramIndex = 0;
  const mocks = {
    react: { useState: () => [modalState, v => { modalState = v; }] },
    '@/shared/ui': {
      Card: 'card', QueryState: 'query', SimpleTable: 'table',
      ConfirmDialog: 'confirm-dialog',
    },
    '@/shared/lib/dates': { formatDate: x => x, formatInstantDateTime: x => x },
    '@/shared/router/listState': { useStringParam: () => [['', ''][paramIndex++], () => {}] },
  };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/features/warehouse-work/FactoryPending.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new Function('require', 'exports', code)(name => mocks[name] ?? require(name), mod.exports);
  const first = mod.exports.FactoryPending({
    warehouses: [{ id: 'W1', name: 'Kho A' }],
    query: { data: [pallet] },
    admin: false,
    busy: false,
    onOpen(p) { opened.push(p); },
    refresh() {},
  });
  const table = all(first, n => n.type === 'query')[0].props.children();
  const btn = table.props.columns.at(-1).cell(pallet);
  assert.equal(btn.props.children, 'Bắt đầu kiểm đếm');
  btn.props.onClick();
  assert.equal(modalState, pallet);

  // Render with modalState active
  paramIndex = 0;
  const second = mod.exports.FactoryPending({
    warehouses: [{ id: 'W1', name: 'Kho A' }],
    query: { data: [pallet] },
    admin: false,
    busy: false,
    onOpen(p) { opened.push(p); },
    refresh() {},
  });
  const dialog = all(second, n => n.type === 'confirm-dialog')[0];
  assert.ok(dialog);
  assert.equal(dialog.props.title, 'Xác nhận thực hiện kiểm đếm pallet');
  assert.equal(dialog.props.confirmLabel, 'Bắt đầu kiểm đếm');
  dialog.props.onConfirm();
  assert.deepEqual(opened, [pallet]);
});
