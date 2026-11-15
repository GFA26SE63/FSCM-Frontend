const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function page(states, docs = [], post = async () => ({ data: { document: { id: 'receipt' } } })) {
  let stateIndex = 0;
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/features/warehouse-work/index.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const mocks = {
    './PalletReceiving': { PalletReceiving: 'inspection' },
    react: { useState: () => [states[stateIndex++], () => {}], useRef: value => ({ current: value }) },
    '@tanstack/react-query': {
      useQuery: options => options.queryKey[0] === 'warehouse-documents' ? { data: docs } : { data: [] },
      useQueryClient: () => ({ invalidateQueries: async () => {} }),
    },
    '@/shared/auth/AuthContext': { useAuth: () => ({ user: { role: 'WarehouseKeeper' } }) },
    '@/shared/api/http': { get() {}, http: { post } },
    '@/shared/api/errors': { errorMessage: e => e.message },
    '@/shared/ui': { Card: 'section', PageHeader: 'header', QueryState: 'query', SimpleTable: 'table' },
    '@/features/receipts/api': { receiptApi: {} }, '@/features/runpicking/api': { pickingApi: {} },
    '@/features/factory-traceability': { TraceLookup: 'trace' },
    '@/shared/lib/dates': { formatDate: x => x, formatInstantDateTime: x => x },
    'react-router-dom': { Link: 'a' },
  };
  const mod = { exports: {} };
  new Function('require', 'exports', 'module', code)(name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), mod.exports, mod);
  return mod.exports.WarehouseWorkPage();
}
function all(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  return [...(predicate(node) ? [node] : []), ...[node.props?.children].flat(Infinity).flatMap(child => all(child, predicate))];
}
function states(selected = '', scan = '') { return [selected, 'warehouse', '', 'Order', [], [], 'delivery note', scan, false, '', '', '']; }

test('factory receipt creation sends warehouse and note without invented batch, dates, SKU or labels', async () => {
  const writes = [];
  const tree = page(states(), [], async (...args) => { writes.push(args); return { data: { document: { id: 'receipt' } } }; });
  all(tree, n => n.type === 'form')[0].props.onSubmit({ preventDefault() {} });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(writes.length, 1);
  assert.equal(writes[0][0], '/warehouse-documents/factory-receipts');
  assert.deepEqual(writes[0][1], { warehouseId: 'warehouse', note: 'delivery note' });
  assert.ok(writes[0][2].headers['Idempotency-Key']);
  assert.equal(all(tree, n => n.type === 'input' && n.props.type === 'date').length, 0);
});


function inspection(states, { reports = [], post = async () => {}, get = async () => ({ pallet: { code: 'PID-1' }, cartons: [] }) } = {}) {
  let index = 0;
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/features/warehouse-work/PalletReceiving.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const mocks = {
    react: { useState: () => [states[index++], () => {}], useRef: value => ({ current: value }) },
    '@tanstack/react-query': { useQuery: () => ({ data: reports }), useQueryClient: () => ({ invalidateQueries: async () => {} }) },
    '@/shared/api/http': { get, http: { post } },
    '@/shared/api/errors': { errorMessage: e => e.message },
    '@/shared/ui': { SimpleTable: 'table' },
  };
  const mod = { exports: {} };
  new Function('require', 'exports', 'module', code)(name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), mod.exports, mod);
  return mod.exports.PalletReceiving({ documentId: 'receipt', version: 3, editable: true });
}

test('pallet preview is read-only and suppresses double scanner submission', async () => {
  const reads = [], writes = [];
  const tree = inspection(['PID-1', undefined, [], '', false], {
    get: async (...args) => { reads.push(args); return { pallet: { code: 'PID-1' }, cartons: [{ code: 'CID-1' }] }; },
    post: async (...args) => writes.push(args),
  });
  const form = all(tree, n => n.type === 'form')[0];
  form.props.onSubmit({ preventDefault() {} }); form.props.onSubmit({ preventDefault() {} });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(reads.length, 1); assert.equal(writes.length, 0);
  assert.deepEqual(reads[0], ['/warehouse-documents/receipt/pallet-preview', { code: 'PID-1' }]);
});

test('receiving submits each disposition and quarantine location once', async () => {
  const writes = [];
  const rows = [
    { cartonCode: 'A', disposition: 'Accepted', reason: '', quarantineLocation: '' },
    { cartonCode: 'B', disposition: 'Damaged', reason: 'Wet', quarantineLocation: 'Q-01' },
    { cartonCode: 'C', disposition: 'Missing', reason: 'Absent', quarantineLocation: '' },
  ];
  const tree = inspection(['PID-1', { pallet: { code: 'PID-1' }, sku: 'SKU', cartons: [] }, rows, '', false], { post: async (...args) => writes.push(args) });
  const save = all(tree, n => n.type === 'button' && n.props.children === 'Xác nhận kết quả và nhận pallet')[0];
  assert.equal(save.props.disabled, false);
  save.props.onClick(); save.props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0], ['/warehouse-documents/receipt/receive-pallet', { palletCode: 'PID-1', expectedVersion: 3, cartons: rows }]);
});

test('incomplete inspection and damage without quarantine location cannot be received', () => {
  for (const row of [ { cartonCode: 'A', disposition: '', reason: '', quarantineLocation: '' }, { cartonCode: 'A', disposition: 'Damaged', reason: 'Wet', quarantineLocation: '' } ]) {
    const tree = inspection(['PID-1', { pallet: { code: 'PID-1' } }, [row], '', false]);
    assert.equal(all(tree, n => n.type === 'button' && n.props.children === 'Xác nhận kết quả và nhận pallet')[0].props.disabled, true);
  }
});

test('empty receipt cannot close, but recorded all-missing receipt can close', () => {
  for (const hasReport of [false, true]) {
    const tree = inspection(['', undefined, [], '', false], { reports: hasReport ? [{ palletCode: 'PID-1', cartons: [{ cartonCode: 'A', disposition: 'Missing', reason: 'Absent' }] }] : [] });
    assert.equal(all(tree, n => n.type === 'button' && n.props.children === 'Hoàn tất phiếu nhập')[0].props.disabled, !hasReport);
  }
});
