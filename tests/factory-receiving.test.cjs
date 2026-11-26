const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const workflowModule = { exports: {} };
new Function('exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/features/warehouse-work/workflow.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText)(workflowModule.exports);

const historyModel = (() => {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/features/warehouse-work/receiptHistoryModel.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const mod = { exports: {} };
  new Function('exports', 'module', code)(mod.exports, mod);
  return mod.exports;
})();
function page(states, docs = [], post = async () => ({ data: { document: { id: 'receipt', reason: 'Factory' } } }), { workflow = 'inbound', role = 'WarehouseKeeper', search = '?new=1', push = () => {}, factoryRequests = false } = {}) {
  let stateIndex = 0;
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/features/warehouse-work/index.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const mocks = {
    './PalletReceiving': { PalletReceiving: 'inspection' },
    './PalletCamera': { PalletCamera: 'camera' },
    './WarehouseOutboundTabs': { WarehouseOutboundTabs: 'outbound-tabs' },
    './WarehouseInboundTabs': { WarehouseInboundTabs: 'inbound-tabs' },
    '@/shared/api/graphql': { graphql: async () => ({ entities: { warehouseTransfers: { nodes: [], pageInfo: { hasNextPage: false } } } }) },
    './FactoryPending': { FactoryPending: 'pending' },
    './FactoryReceiptHistory': { FactoryReceiptHistory: 'receipt-history' },
    './receiptHistoryModel': historyModel,
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
    '@/shared/ui': { Button: 'button', Card: 'section', PageHeader: 'header', QueryState: 'query', SimpleTable: 'table' },
    '@/shared/lib/excel': { downloadExcel: async () => {} },
    '@/features/receipts/api': { receiptApi: {} }, '@/features/runpicking/api': { pickingApi: {} },
    '@/features/factory-traceability': { TraceLookup: 'trace' },
    '@/shared/lib/dates': { formatDate: x => x, formatInstantDateTime: x => x },
    '@/shared/router/listState': { useStringParam: () => [states[stateIndex++], () => {}] },
    'react-router-dom': { Link: 'a', Redirect: 'redirect', useHistory: () => ({ push }), useLocation: () => ({ search: '', pathname: workflowModule.exports.warehouseScreens[workflow].path + (search === '?new=1' ? '/new' : '') }), useParams: () => ({ documentId: new URLSearchParams(search).get('document') ?? undefined }) },
  };
  const mod = { exports: {} };
  new Function('require', 'exports', 'module', code)(name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), mod.exports, mod);
  return mod.exports.WarehouseOperationsPage({ workflow, factoryRequests });
}
function all(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  return [...(predicate(node) ? [node] : []), ...[node.props?.children].flat(Infinity).flatMap(child => all(child, predicate))];
}
function states(scan = '', tab = '') { return ['warehouse', '', [], [], 'delivery note', scan, false, '', '', false, '', '', '', '', tab, null]; }

test('a dispatch-note row opens one PNK for the whole note without sending a warehouse chosen by the keeper', async () => {
  const writes = [];
  const navigations = [];
  const tree = page(states('', 'factory'), [], async (...args) => { writes.push(args); return { data: { document: { id: 'receipt', reason: 'Factory' } } }; }, { search: '', factoryRequests: true, push: path => navigations.push(path) });
  const pending = all(tree, n => n.type === 'query')[0].props.children();
  pending.props.onOpen({ dispatchNoteId: 'note-1', dispatchCode: 'PXN-1', destinationWarehouseId: 'factory-selected-warehouse',
    pallets: [{ palletCode: 'PID-1' }, { palletCode: 'PID-2' }] });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(writes.length, 1);
  assert.equal(writes[0][0], '/warehouse-documents/factory-receipts/from-dispatch');
  assert.deepEqual(writes[0][1], { dispatchNoteId: 'note-1' });
  assert.equal(navigations[0], '/warehouse-inbound/receipt');
});

test('pallets dispatched before dispatch notes still open a receipt from the single pallet', async () => {
  const writes = [];
  const navigations = [];
  const tree = page(states('', 'factory'), [], async (...args) => { writes.push(args); return { data: { document: { id: 'receipt', reason: 'Factory' } } }; }, { search: '', factoryRequests: true, push: path => navigations.push(path) });
  const pending = all(tree, n => n.type === 'query')[0].props.children();
  pending.props.onOpen({ dispatchNoteId: null, dispatchCode: 'PID-1', destinationWarehouseId: 'factory-selected-warehouse', pallets: [{ palletCode: 'PID-1' }] });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(writes.length, 1);
  assert.equal(writes[0][0], '/warehouse-documents/factory-receipts/from-pallet');
  assert.deepEqual(writes[0][1], { palletCode: 'PID-1' });
  assert.equal(navigations[0], '/warehouse-inbound/receipt?pallet=PID-1');
  assert.equal(all(tree, n => n.type === 'form').length, 0);
});

test('warehouse lists isolate factory, order and transfer documents with separate detail links', () => {
  const docs = ['Factory', 'Order', 'Transfer'].map(reason => ({ document: { id: reason, reason, kind: reason === 'Transfer' ? 'Request' : 'Receipt', status: 'Posted', code: reason, warehouseId: 'warehouse', createdAt: '2026-01-01' }, lines: [], cartons: [] }));
  for (const [workflow, reason] of [['receipts', 'Factory'], ['outbound', 'Order'], ['transfer', 'Transfer']]) {
    const navigations = [];
    const tree = page(states('', workflow === 'receipts' ? 'history' : ''), docs, undefined, { workflow, search: '', push: path => navigations.push(path) });
    assert.equal(all(tree, n => n.type === 'form').length, 0, 'list must not expose a creation form');
    assert.equal(all(tree, n => n.type === 'trace').length, 0, 'tracing belongs on its own page');
    const content = all(tree, n => n.type === 'query').find(n => n.props.query.data === docs).props.children();
    if (workflow === 'receipts') {
      // Factory receipt history: one row per dispatch note, opened through onOpen.
      assert.equal(content.type, 'receipt-history');
      assert.deepEqual(content.props.rows.map(r => r.docs[0].document.reason), [reason]);
      content.props.onOpen(content.props.rows[0].docs[0].document.id);
      assert.equal(navigations[0], '/warehouse-receipts/Factory');
      continue;
    }
    const table = content;
    assert.deepEqual(table.props.rows.map(w => w.document.reason), [reason]);
    table.props.onRowClick(table.props.rows[0]);
    assert.equal(navigations[0], workflow === 'receipts' ? '/warehouse-receipts/' + table.props.rows[0].document.id : workflowModule.exports.warehouseDocumentPath(table.props.rows[0].document));
  }
});

test('creation controls follow each workflow and keep existing warehouse role boundaries', () => {
  for (const role of ['Admin', 'WarehouseKeeper']) {
    for (const workflow of ['inbound', 'outbound', 'transfer']) {
      const tree = page(states(), [], undefined, { workflow, role });
      assert.equal(all(tree, n => n.type === 'form').length, Number(workflow !== 'inbound'));
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


function inspection(states, { reports = [], post = async () => {}, get = async () => ({ pallet: { code: 'PID-1' }, cartons: [] }), initialCode = '', expected } = {}) {
  let index = 0;
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/features/warehouse-work/PalletReceiving.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const mocks = {
    react: { useState: () => [states[index++], () => {}], useRef: value => ({ current: value }) },
    '@tanstack/react-query': { useQuery: options => ({ data: options.queryKey[0] === 'receipt-expected' ? expected : reports }), useQueryClient: () => ({ invalidateQueries: async () => {} }) },
    '@/shared/api/http': { get, http: { post } },
    '@/shared/api/errors': { errorMessage: e => e.message },
    '@/shared/ui': { SimpleTable: 'table', ConfirmDialog: 'confirm' },
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
  // The button only opens the confirm popup; confirming (even twice) receives once.
  save.props.onClick();
  assert.equal(writes.length, 0);
  const dialog = all(tree, n => n.type === 'confirm' && n.props.title === 'Xác nhận kết quả kiểm đếm pallet')[0];
  void dialog.props.onConfirm(); void dialog.props.onConfirm();
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
    assert.equal(all(tree, n => n.type === 'button' && n.props.children === 'Hoàn tất & Thực hiện nhập kho')[0].props.disabled, !hasReport);
  }
});


const expectedPallet = (code, received) => ({ palletId: code, palletCode: code, batchCode: 'BID-1', sku: 'SKU', productName: 'Sữa', cartonCount: 10, expirationDate: '2026-12-31', received, receivedAt: received ? '2026-11-22T02:00:00Z' : null });
const note = pallets => ({ dispatchNoteId: 'note-1', dispatchCode: 'PXN-1', vehicleNumber: '59C-123.45', driverName: 'Tài xế Ba', pallets });
const text = node => JSON.stringify(node);

test('dispatch-note PNK lists the pallets to receive and completes only after all are received', () => {
  const closeButton = tree => all(tree, n => n.type === 'button' && n.props.children === 'Hoàn tất & Thực hiện nhập kho')[0];
  const partial = inspection(['', undefined, [], '', false], { expected: note([expectedPallet('PID-1', true), expectedPallet('PID-2', false)]), reports: [{ palletCode: 'PID-1', cartons: [] }] });
  const list = all(partial, n => n.type === 'table' && n.props.columns[0].header === 'Pallet cần nhận')[0];
  assert.deepEqual(list.props.rows.map(p => p.palletCode), ['PID-1', 'PID-2']);
  assert.ok(text(partial).includes('Đã xử lý 1 / 2 pallet'));
  assert.equal(all(partial, n => n.type === 'camera').length, 1, 'scanner stays available for the next pallet');
  assert.equal(closeButton(partial).props.disabled, true);

  const done = inspection(['', undefined, [], '', false], { expected: note([expectedPallet('PID-1', true), expectedPallet('PID-2', true)]) });
  assert.equal(closeButton(done).props.disabled, false);
  assert.equal(all(done, n => n.type === 'camera').length, 0, 'no more pallets to scan');
  assert.ok(text(done).includes('Đã nhận đủ 2 pallet'));
});

test('scanning a pallet that is not on the dispatch note, or already received, is refused before calling the server', async () => {
  const writes = [];
  const tree = inspection(['', undefined, [], '', false], { expected: note([expectedPallet('PID-1', true), expectedPallet('PID-2', false)]), post: async (...args) => { writes.push(args); return { data: {} }; } });
  const camera = all(tree, n => n.type === 'camera')[0];
  await camera.props.onScan('PID-9');
  await camera.props.onScan('PID-1');
  assert.equal(writes.length, 0);
  await camera.props.onScan(' PID-2 ');
  assert.equal(writes.length, 1);
  assert.equal(writes[0][0], '/warehouse-documents/receipt/pallet-scans');
  assert.equal(writes[0][1].code, 'PID-2');
});

test('a pallet that never arrived is recorded as "Thiếu cả pallet" with a trimmed reason', async () => {
  const writes = [];
  const expected = note([expectedPallet('PID-1', true), expectedPallet('PID-2', false)]);
  // states: scan, manifest, rows, error, busy, confirming, missingTarget, missingReason
  const tree = inspection(['', undefined, [], '', false, false, 'PID-2', '  Xe giao thiếu  '], { expected, post: async (...args) => { writes.push(args); return { data: {} }; } });
  const list = all(tree, n => n.type === 'table' && n.props.columns[0].header === 'Pallet cần nhận')[0];
  const action = list.props.columns.find(c => c.header === 'Thao tác');
  assert.equal(action.cell(expected.pallets[0]), '—', 'received pallets cannot be marked missing');
  assert.equal(action.cell(expected.pallets[1]).props.children, 'Đánh dấu thiếu cả pallet');
  const dialog = all(tree, n => n.type === 'confirm' && n.props.title === 'Đánh dấu thiếu cả pallet')[0];
  assert.equal(dialog.props.open, true);
  await dialog.props.onConfirm();
  assert.deepEqual(writes, [['/warehouse-documents/receipt/missing-pallet', { palletCode: 'PID-2', expectedVersion: 3, reason: 'Xe giao thiếu' }]]);
});

test('an empty reason is refused, and a missing pallet counts as handled so the PNK can be completed', async () => {
  const writes = [];
  const blank = inspection(['', undefined, [], '', false, false, 'PID-2', '   '], { expected: note([expectedPallet('PID-2', false)]), post: async (...args) => { writes.push(args); } });
  await all(blank, n => n.type === 'confirm' && n.props.title === 'Đánh dấu thiếu cả pallet')[0].props.onConfirm();
  assert.equal(writes.length, 0);
  const done = inspection(['', undefined, [], '', false], { expected: note([expectedPallet('PID-1', true), { ...expectedPallet('PID-2', true), missing: true }]) });
  assert.equal(all(done, n => n.type === 'button' && n.props.children === 'Hoàn tất & Thực hiện nhập kho')[0].props.disabled, false);
  assert.ok(text(done).includes('thiếu cả pallet: 1'));
  const status = all(done, n => n.type === 'table' && n.props.columns[0].header === 'Pallet cần nhận')[0].props.columns.find(c => c.header === 'Trạng thái');
  assert.equal(status.cell({ ...expectedPallet('PID-2', true), missing: true }).props.children, 'Thiếu cả pallet');
});

test('transfer arrivals only offer posted issues for the receiving warehouse and open a receipt', async () => {
  const values = states(); values[13] = 'Transfer';
  const docs = [
    { document: { id: 'incoming', code: 'PXK-1', createdAt: '2026-01-01', kind: 'Issue', reason: 'Transfer', status: 'Posted', warehouseId: 'source', destinationWarehouseId: 'warehouse' }, transportStatus: 'InTransit', lines: [], cartons: [] },
    { document: { id: 'not-exported', kind: 'Issue', reason: 'Transfer', status: 'Open', warehouseId: 'source', destinationWarehouseId: 'warehouse' }, lines: [], cartons: [] },
    { document: { id: 'other-warehouse', kind: 'Issue', reason: 'Transfer', status: 'Posted', warehouseId: 'source', destinationWarehouseId: 'other' }, lines: [], cartons: [] },
  ];
  const writes = [], paths = [];
  const tree = page(values, docs, async (...args) => { writes.push(args); return { data: { document: { id: 'pnk', kind: 'Receipt', reason: 'Transfer' } } }; }, { search: '', push: path => paths.push(path) });
  const arrivalsQuery = all(tree, n => n.type === 'query').find(n => n.props.query.data === docs);
  const arrivals = arrivalsQuery.props.children();
  assert.deepEqual(arrivals.props.rows.map(w => w.issue.document.id), ['incoming']);
  arrivals.props.onRowClick(arrivals.props.rows[0]);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(writes[0][0], '/warehouse-documents/incoming/create-document');
  assert.equal(paths[0], '/warehouse-inbound/pnk');
});
