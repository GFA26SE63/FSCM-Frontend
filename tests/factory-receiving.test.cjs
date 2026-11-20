const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const workflowModule = { exports: {} };
new Function('exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/features/warehouse-work/workflow.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText)(workflowModule.exports);

function page(states, docs = [], post = async () => ({ data: { document: { id: 'receipt', reason: 'Factory' } } }), { workflow = 'inbound', role = 'WarehouseKeeper', search = '?new=1', push = () => {} } = {}) {
  let stateIndex = 0;
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/features/warehouse-work/index.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const mocks = {
    './PalletReceiving': { PalletReceiving: 'inspection' },
    './FactoryPending': { FactoryPending: 'pending' },
    './workflow': workflowModule.exports,
    './warehouse-work.css': {},
    react: { useState: () => [states[stateIndex++], () => {}], useRef: value => ({ current: value }) },
    '@tanstack/react-query': {
      useQuery: options => options.queryKey[0] === 'warehouse-documents' ? { data: docs } : { data: [] },
      useQueryClient: () => ({ invalidateQueries: async () => {} }),
    },
    '@/shared/auth/AuthContext': { useAuth: () => ({ user: { role, scope: { warehouseIds: ['warehouse'] } } }) },
    '@/shared/api/http': { get() {}, http: { post } },
    '@/shared/api/errors': { errorMessage: e => e.message },
    '@/shared/ui': { Card: 'section', PageHeader: 'header', QueryState: 'query', SimpleTable: 'table' },
    '@/features/receipts/api': { receiptApi: {} }, '@/features/runpicking/api': { pickingApi: {} },
    '@/features/factory-traceability': { TraceLookup: 'trace' },
    '@/shared/lib/dates': { formatDate: x => x, formatInstantDateTime: x => x },
    '@/shared/router/listState': { useStringParam: () => [states[stateIndex++], () => {}] },
    'react-router-dom': { Link: 'a', Redirect: 'redirect', useHistory: () => ({ push }), useLocation: () => ({ search: '', pathname: workflowModule.exports.warehouseScreens[workflow].path + (search === '?new=1' ? '/new' : '') }), useParams: () => ({ documentId: new URLSearchParams(search).get('document') ?? undefined }) },
  };
  const mod = { exports: {} };
  new Function('require', 'exports', 'module', code)(name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), mod.exports, mod);
  return mod.exports.WarehouseOperationsPage({ workflow });
}
function all(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  return [...(predicate(node) ? [node] : []), ...[node.props?.children].flat(Infinity).flatMap(child => all(child, predicate))];
}
function states(scan = '') { return ['warehouse', '', [], [], 'delivery note', scan, false, '', '', '', '', '', '', null]; }

test('factory receipt starts from the selected pallet without sending a warehouse chosen by the keeper', async () => {
  const writes = [];
  const navigations = [];
  const tree = page(states(), [], async (...args) => { writes.push(args); return { data: { document: { id: 'receipt', reason: 'Factory' } } }; }, { search: '', push: path => navigations.push(path) });
  const pending = all(tree, n => n.type === 'query')[0].props.children();
  pending.props.onOpen({ palletCode: 'PID-1', destinationWarehouseId: 'factory-selected-warehouse' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(writes.length, 1);
  assert.equal(writes[0][0], '/warehouse-documents/factory-receipts/from-pallet');
  assert.deepEqual(writes[0][1], { palletCode: 'PID-1' });
  assert.equal(navigations[0], '/warehouse-inbound/receipt?pallet=PID-1');
  assert.equal(all(tree, n => n.type === 'form').length, 0);
});

test('warehouse lists isolate factory, order and transfer documents with separate detail links', () => {
  const docs = ['Factory', 'Order', 'Transfer'].map(reason => ({ document: { id: reason, reason, kind: 'Receipt', status: 'Posted', code: reason, warehouseId: 'warehouse' }, lines: [], cartons: [] }));
  for (const [workflow, reason] of [['receipts', 'Factory'], ['outbound', 'Order'], ['transfer', 'Transfer']]) {
    const navigations = [];
    const tree = page(states(), docs, undefined, { workflow, search: '', push: path => navigations.push(path) });
    assert.equal(all(tree, n => n.type === 'form').length, 0, 'list must not expose a creation form');
    assert.equal(all(tree, n => n.type === 'trace').length, 0, 'tracing belongs on its own page');
    const table = all(tree, n => n.type === 'query').find(n => n.props.query.data === docs).props.children();
    assert.deepEqual(table.props.rows.map(w => w.document.reason), [reason]);
    const button = table.props.columns[0].cell(table.props.rows[0]);
    button.props.onClick();
    assert.equal(navigations[0], workflow === 'receipts' ? '/warehouse-receipts/' + table.props.rows[0].document.id : workflowModule.exports.warehouseDocumentPath(table.props.rows[0].document));
  }
});

test('creation controls follow each workflow and keep existing warehouse role boundaries', () => {
  for (const role of ['Admin', 'WarehouseKeeper']) {
    for (const workflow of ['inbound', 'outbound', 'transfer']) {
      const tree = page(states(), [], undefined, { workflow, role });
      assert.equal(all(tree, n => n.type === 'form').length, Number(workflow !== 'inbound' && role === 'Admin'));
    }
  }
});

test('outbound and transfer forms submit the matching request type and navigate to its own detail', async () => {
  for (const [workflow, reason] of [['outbound', 'Order'], ['transfer', 'Transfer']]) {
    const values = states();
    values[1] = 'destination';
    values[2] = ['order-1'];
    values[3] = [{ batchId: 'batch-1', quantity: 2 }];
    const writes = [], navigations = [];
    const tree = page(values, [], async (...args) => {
      writes.push(args);
      return { data: { document: { id: 'created', reason } } };
    }, { workflow, role: 'Admin', push: path => navigations.push(path) });
    all(tree, n => n.type === 'form')[0].props.onSubmit({ preventDefault() {} });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(writes[0][0], '/warehouse-documents/requests');
    assert.equal(writes[0][1].reason, reason);
    assert.equal(writes[0][1].destinationWarehouseId, workflow === 'transfer' ? 'destination' : null);
    assert.deepEqual(writes[0][1].orderIds, workflow === 'outbound' ? ['order-1'] : []);
    assert.deepEqual(writes[0][1].lines, workflow === 'transfer' ? [{ batchId: 'batch-1', quantity: 2 }] : []);
    assert.equal(navigations[0], `${workflowModule.exports.warehouseScreens[workflow].path}/created`);
  }
});

test('transfer receipts route to inbound and transfer picking/issues route to outbound', () => {
  const receipt = { id: 'receipt', reason: 'Transfer', kind: 'Receipt' };
  assert.equal(workflowModule.exports.warehouseDocumentPath(receipt), '/warehouse-inbound/receipt');
  assert.equal(workflowModule.exports.belongsToWorkflow(receipt, 'inbound'), true);
  assert.equal(workflowModule.exports.belongsToWorkflow(receipt, 'outbound'), false);
  for (const kind of ['Picking', 'Issue']) {
    const issue = { id: 'issue', reason: 'Transfer', kind };
    assert.equal(workflowModule.exports.warehouseDocumentPath(issue), '/warehouse-outbound/issue');
    assert.equal(workflowModule.exports.belongsToWorkflow(issue, 'outbound'), true);
    assert.equal(workflowModule.exports.belongsToWorkflow(issue, 'inbound'), false);
  }
});


function inspection(states, { reports = [], post = async () => {}, get = async () => ({ pallet: { code: 'PID-1' }, cartons: [] }), initialCode = '' } = {}) {
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
    './PalletCamera': { PalletCamera: 'camera' },
    '@/shared/lib/dates': { formatInstantDateTime: value => value },
  };
  const mod = { exports: {} };
  new Function('require', 'exports', 'module', code)(name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), mod.exports, mod);
  return mod.exports.PalletReceiving({ documentId: 'receipt', version: 3, editable: true, initialCode });
}

test('receipt shows expected pallet and camera instead of a prefilled confirmation input', () => {
  const tree = inspection([undefined, undefined, [], '', false], { initialCode: 'PID-1' });
  assert.equal(all(tree, n => n.type === 'camera').length, 1);
  assert.equal(all(tree, n => n.type === 'input').length, 0);
  assert.equal(all(tree, n => n.type === 'form').length, 0);
});

test('camera decoding records one server scan without confirming receipt or increasing stock', async () => {
  const writes = [];
  const tree = inspection([undefined, undefined, [], '', false], {
    post: async (...args) => { writes.push(args); return { data: { id: 'scan-1', documentVersion: 4, manifest: { pallet: { code: 'PID-1' }, cartons: [{ code: 'CID-1' }] } } }; },
  });
  const camera = all(tree, n => n.type === 'camera')[0];
  await Promise.all([camera.props.onScan('PID-1'), camera.props.onScan('PID-1')]);
  assert.deepEqual(writes, [['/warehouse-documents/receipt/pallet-scans', { code: 'PID-1', expectedVersion: 3, source: 'Camera' }]]);
});

test('receiving submits each disposition and quarantine location once', async () => {
  const writes = [];
  const rows = [
    { cartonCode: 'A', disposition: 'Accepted', reason: '', quarantineLocation: '' },
    { cartonCode: 'B', disposition: 'Damaged', reason: 'Wet', quarantineLocation: 'Q-01' },
    { cartonCode: 'C', disposition: 'Missing', reason: 'Absent', quarantineLocation: '' },
  ];
  const tree = inspection([{ id: 'scan-1', documentVersion: 4, scannedAt: '2026-11-17T10:00:00Z' }, { pallet: { code: 'PID-1' }, sku: 'SKU', cartons: [] }, rows, '', false], { post: async (...args) => writes.push(args) });
  const save = all(tree, n => n.type === 'button' && n.props.children === 'Xác nhận kết quả và nhận pallet')[0];
  assert.equal(save.props.disabled, false);
  save.props.onClick(); save.props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0], ['/warehouse-documents/receipt/receive-pallet', { palletCode: 'PID-1', expectedVersion: 4, scanId: 'scan-1', cartons: rows }]);
});

test('incomplete inspection and damage without quarantine location cannot be received', () => {
  for (const row of [ { cartonCode: 'A', disposition: '', reason: '', quarantineLocation: '' }, { cartonCode: 'A', disposition: 'Damaged', reason: 'Wet', quarantineLocation: '' } ]) {
    const tree = inspection([{ id: 'scan-1', documentVersion: 4, scannedAt: '2026-11-17T10:00:00Z' }, { pallet: { code: 'PID-1' } }, [row], '', false]);
    assert.equal(all(tree, n => n.type === 'button' && n.props.children === 'Xác nhận kết quả và nhận pallet')[0].props.disabled, true);
  }
});

test('empty receipt cannot close, but recorded all-missing receipt can close', () => {
  for (const hasReport of [false, true]) {
    const tree = inspection(['', undefined, [], '', false], { reports: hasReport ? [{ palletCode: 'PID-1', cartons: [{ cartonCode: 'A', disposition: 'Missing', reason: 'Absent' }] }] : [] });
    assert.equal(all(tree, n => n.type === 'button' && n.props.children === 'Hoàn tất phiếu nhập')[0].props.disabled, !hasReport);
  }
});


test('transfer arrivals only offer posted issues for the receiving warehouse and open a receipt', async () => {
  const values = states(); values[12] = 'Transfer';
  const docs = [
    { document: { id: 'incoming', kind: 'Issue', reason: 'Transfer', status: 'Posted', warehouseId: 'source', destinationWarehouseId: 'warehouse' }, lines: [], cartons: [] },
    { document: { id: 'not-exported', kind: 'Issue', reason: 'Transfer', status: 'Open', warehouseId: 'source', destinationWarehouseId: 'warehouse' }, lines: [], cartons: [] },
    { document: { id: 'other-warehouse', kind: 'Issue', reason: 'Transfer', status: 'Posted', warehouseId: 'source', destinationWarehouseId: 'other' }, lines: [], cartons: [] },
  ];
  const writes = [], paths = [];
  const tree = page(values, docs, async (...args) => { writes.push(args); return { data: { document: { id: 'pnk', kind: 'Receipt', reason: 'Transfer' } } }; }, { search: '', push: path => paths.push(path) });
  const arrivals = all(tree, n => n.type === 'table' && n.props.columns[0].header === 'Phiếu xuất')[0];
  assert.deepEqual(arrivals.props.rows.map(w => w.document.id), ['incoming']);
  arrivals.props.columns[2].cell(arrivals.props.rows[0]).props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(writes[0][0], '/warehouse-documents/incoming/create-document');
  assert.equal(paths[0], '/warehouse-inbound/pnk');
});
