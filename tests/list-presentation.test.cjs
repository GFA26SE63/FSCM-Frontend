const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function source(file, mocks = {}, cache = new Map()) {
  const filename = path.resolve(__dirname, '../src', file);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  new Function('require', 'module', 'exports', code)(name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith('.')) {
      const target = path.resolve(path.dirname(filename), name);
      const resolved = ['.ts', '.tsx'].map(ext => target + ext).find(fs.existsSync);
      if (resolved) return source(path.relative(path.resolve(__dirname, '../src'), resolved), mocks, cache);
    }
    return require(name);
  }, module, module.exports);
  return module.exports;
}

test('features explicitly choose list columns without changing the full search/export schema', () => {
  const { listColumns } = source('shared/ui/tableColumns.ts');
  const columns = ['code', 'retailer', 'creator', 'createdAt', 'amount', 'status'].map(key => ({ key }));
  const selected = listColumns(columns, ['code', 'retailer', 'createdAt', 'amount', 'status'], c => c.key);
  assert.deepEqual(selected.map(c => c.key), ['code', 'retailer', 'createdAt', 'amount', 'status']);
  assert.equal(columns.length, 6);
  assert.equal(columns[2].key, 'creator');
  assert.deepEqual(listColumns(columns, undefined, c => c.key), columns);
  assert.throws(() => listColumns(columns, ['missing'], c => c.key));
});

test('a list has one existing view action and no extra detail column or generated dialog', () => {
  const row = { code: 'CID-F01-20261124-A-0001-0001', batch: 'BID-F01', status: 'Sẵn sàng' };
  const { SimpleTable } = source('shared/ui/SimpleTable.tsx');
  const columns = [
    { header: 'Mã', cell: r => r.code },
    { header: 'Tên', cell: () => 'Sữa tươi' },
    { header: 'Kho', cell: () => 'WH-Q7' },
    { header: 'Pallet', cell: () => 'PID-ORIGINAL' },
    { header: 'Lô nhà máy', cell: r => React.createElement('a', { href: '/source-lot' }, r.batch) },
    { header: 'Trạng thái', cell: r => r.status },
    { header: 'Thao tác', cell: () => React.createElement('button', { 'data-action': 'view' }, 'Xem') },
  ];
  const html = renderToStaticMarkup(React.createElement(SimpleTable, { rows: [row], columns,
    summaryColumns: ['Mã', 'Tên', 'Trạng thái', 'Thao tác'], onRowClick: () => {} }));
  assert.doesNotMatch(html, /role="dialog"|<th[^>]*>Chi tiết<\/th>/);
  assert.equal((html.match(/>Xem<\/button>/g) || []).length, 1);
  assert.match(html, /data-action="view"/);
  assert.ok(html.includes(row.code));
  assert.ok(html.includes(row.status));
  assert.ok(!html.includes('PID-ORIGINAL'));
  assert.equal(columns[4].cell(row).props.href, '/source-lot');
  for (const size of [10, 20, 50]) assert.match(html, new RegExp(`value="${size}"`));
});

test('receipt grouping shows the newest PNK without losing pallets, quantity or mutating source order', () => {
  const model = source('features/warehouse-work/receiptHistoryModel.ts');
  const old = { document: { id: 'old', code: 'PNK-OLD', createdAt: '2026-11-22T00:00:00Z', status: 'Posted', warehouseId: 'wh' }, lines: [{ quantity: 2 }] };
  const latest = { document: { ...old.document, id: 'new', code: 'PNK-NEW', createdAt: '2026-11-24T00:00:00Z' }, lines: [{ quantity: 3 }] };
  const group = { key: 'dispatch', dispatchCode: 'PXN-1', documentIds: ['old', 'new'], pallets: [{ palletCode: 'P1' }, { palletCode: 'P2' }] };
  const result = model.groupHistoryRows([latest, old], [old, latest], [group]);
  assert.equal(result.length, 1);
  assert.equal(result[0].docs[0].document.code, 'PNK-NEW');
  assert.equal(model.rowCartons(result[0]), 5);
  assert.equal(result[0].group.pallets.length, 2);
  assert.deepEqual(group.documentIds, ['old', 'new']);
});

test('notification pagination sends server cursor and page size without a client recipient filter', async () => {
  let request;
  const api = source('features/notifications/notificationsGraphql.ts', {
    '@/shared/api/graphql': { graphql: async (query, variables) => {
      request = { query, variables };
      return { entities: { notifications: { totalCount: 85, nodes: [], pageInfo: { hasPreviousPage: true, hasNextPage: false, startCursor: 'start', endCursor: 'end' } } } };
    } },
    '@/shared/api/errors': { ApiError: Error },
  });
  await api.fetchNotificationPage(50, true, undefined, 'back');
  assert.match(request.query, /last: 50, before: \$cursor/);
  assert.match(request.query, /isRead: \{ eq: false \}/);
  assert.match(request.query, /createdAt: DESC.*id: DESC/);
  assert.deepEqual(request.variables, { cursor: 'back' });
  assert.doesNotMatch(request.query, /userAccountId|recipientId/);
});

test('an already-paged list renders exactly one pager with the full total and 10/20/50 options', () => {
  const { SimpleTable } = source('shared/ui/SimpleTable.tsx');
  const { Pagination } = source('shared/pagination/components/Pagination.tsx');
  const rows = Array.from({ length: 10 }, (_, i) => ({ code: `DH-${i + 1}` }));
  const html = renderToStaticMarkup(React.createElement(React.Fragment, null,
    React.createElement(SimpleTable, { rows, paginate: false, columns: [{ header: 'Mã đơn', cell: r => r.code }] }),
    React.createElement(Pagination, { currentPage: 1, totalPages: 3, totalCount: 22, pageSize: 10, itemCount: 10,
      hasPrev: false, hasNext: true, onPage() {}, onPrev() {}, onNext() {}, onPageSizeChange() {} }),
  ));
  assert.equal((html.match(/aria-label="Phân trang dữ liệu"/g) || []).length, 1);
  assert.equal((html.match(/<select/g) || []).length, 1);
  assert.match(html, /Hiển thị 1–10 \/ 22/);
  assert.doesNotMatch(html, /Hiển thị 1–10 \/ 10/);
  for (const size of [10, 20, 50]) assert.match(html, new RegExp(`value="${size}"`));
  assert.match(html, /aria-current="page"[^>]*>1<\/button>/);
});

test('server/cursor/parent-paged feature tables opt out of a second local pager', () => {
  const cases = [
    ['shipments/pages/OrderReadinessPage.tsx', 'visible'],
    ['reports/OperationsReportsPage.tsx', 'data.items'],
    ['users/components/UserAuditPanel.tsx', 'page.nodes'],
    ['inventory/index.tsx', 'data.items'],
    ['warehouse-work/index.tsx', 'data.items'],
    ['gifts/pages/GiftsPage.tsx', 'page.items'],
  ];
  for (const [file, rows] of cases) {
    const filename = `features/${file}`;
    const ast = ts.createSourceFile(filename, fs.readFileSync(path.resolve(__dirname, '../src', filename), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let found = false;
    function visit(node) {
      if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(ast) === 'SimpleTable') {
        const attrs = node.attributes.properties;
        const rowAttr = attrs.find(a => ts.isJsxAttribute(a) && a.name.text === 'rows');
        if (rowAttr?.initializer?.expression?.getText(ast) === rows) {
          found = true;
          const pager = attrs.find(a => ts.isJsxAttribute(a) && a.name.text === 'paginate');
          assert.equal(pager?.initializer?.expression?.kind, ts.SyntaxKind.FalseKeyword, filename);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
    assert.ok(found, filename);
  }
});
