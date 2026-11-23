const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const src = file => path.resolve(__dirname, '../src/features/warehouse-work', file);
function load(file, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(src(file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'exports', 'module', code)(name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), mod.exports, mod);
  return mod.exports;
}
function all(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  return [...(predicate(node) ? [node] : []), ...[node.props?.children].flat(Infinity).flatMap(child => all(child, predicate))];
}
const model = load('receiptHistoryModel.ts');
const doc = (id, status = 'Posted', lines = []) => ({ document: { id, code: `PNK-${id}`, status, warehouseId: 'W1', createdAt: '2026-11-22T07:00:00Z' }, lines });
const line = (sku, batchCode, quantity) => ({ sku, productName: sku, batchCode, sourceLotCode: 'BID-1', quantity, expirationDate: '2026-11-30' });
const group = (key, ids, code, pallets) => ({ key, dispatchCode: code, dispatchedAt: '2026-11-22T07:16:21Z', documentIds: ids,
  pallets: pallets.map(([palletCode, documentId, accepted = 10, damaged = 0, missing = 0]) => ({ palletCode, documentId, accepted, damaged, missing })) });

test('older per-pallet PNKs of one dispatch note show as one history row carrying every PNK of the note', () => {
  const a = doc('a', 'Posted', [line('SKU001', 'B1', 9)]), b = doc('b', 'Posted', [line('SKU001', 'B1', 10)]), c = doc('c');
  const groups = [group('note:1', ['a', 'b'], 'PXN-F01-20261122-0003', [['PID-1', 'a', 9, 0, 1], ['PID-2', 'b']]), group('note:2', ['c'], 'PXN-NEW', [['PID-3', 'c'], ['PID-4', 'c']])];
  const rows = model.groupHistoryRows([c, b, a], [c, b, a], groups);
  assert.deepEqual(rows.map(r => r.docs.map(w => w.document.id)), [['c'], ['a', 'b']]);
  const old = rows[1];
  assert.equal(model.rowCartons(old), 19);
  assert.equal(model.rowStatus(old), 'Posted');
  assert.equal(model.dispatchLabel(old), 'PXN-F01-20261122-0003 · 2 pallet · 2 PNK');
  assert.equal(model.dispatchLabel(rows[0]), 'PXN-NEW · 2 pallet');
  assert.deepEqual(model.combinedLines(old).map(l => [l.batchCode, l.quantity]), [['B1', 19]]);
});

test('a filtered-in PNK still brings its whole note; a note is open until every PNK is posted', () => {
  const a = doc('a'), b = doc('b', 'Open');
  const rows = model.groupHistoryRows([b], [a, b], [group('note:1', ['a', 'b'], 'PXN-1', [])]);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].docs.map(w => w.document.id), ['a', 'b']);
  assert.equal(model.rowStatus(rows[0]), 'Open');
});

test('without group data (service down) every PNK keeps its own row', () => {
  const rows = model.groupHistoryRows([doc('a'), doc('b')], [doc('a'), doc('b')], undefined);
  assert.deepEqual(rows.map(r => r.key), ['a', 'b']);
  assert.equal(model.dispatchLabel(rows[0]), '—');
});

test('history row opens the PNK directly, or a popup for a note received on several PNKs', () => {
  let shown = null; const opened = [];
  const { FactoryReceiptHistory } = load('FactoryReceiptHistory.tsx', {
    react: { useState: () => [shown, v => { shown = v; }] },
    '@/shared/ui': { Fields: 'fields', Modal: 'modal', SimpleTable: 'table' },
    '@/shared/lib/dates': { formatDate: x => x, formatInstantDateTime: x => x },
    './receiptHistoryModel': model,
  });
  const single = { key: 'c', docs: [doc('c')], group: null };
  const multi = { key: 'note:1', docs: [doc('a'), doc('b')], group: group('note:1', ['a', 'b'], 'PXN-1', [['PID-1', 'a'], ['PID-2', 'b']]) };
  const props = { rows: [single, multi], whName: () => 'Kho A', statusText: s => s, onOpen: id => opened.push(id) };
  const table = all(FactoryReceiptHistory(props), n => n.type === 'table')[0];
  const action = table.props.columns.at(-1);
  action.cell(single).props.onClick();
  assert.deepEqual(opened, ['c']);
  assert.equal(action.cell(multi).props.children, 'Xem chi tiết');
  action.cell(multi).props.onClick();
  assert.equal(shown, multi);
  const modal = all(FactoryReceiptHistory(props), n => n.type === 'modal')[0];
  assert.equal(modal.props.open, true);
  assert.equal(modal.props.title, 'Phiếu xuất nhà máy PXN-1');
  const tables = all(modal, n => n.type === 'table');
  assert.deepEqual(tables[0].props.rows.map(w => w.document.code), ['PNK-a', 'PNK-b']);
  assert.deepEqual(tables[1].props.rows.map(p => p.palletCode), ['PID-1', 'PID-2']);
});
