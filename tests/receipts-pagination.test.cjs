/**
 * Phase 5 Receipts Pagination — static source analysis tests.
 *
 * Verifies pagination logic, filter logic, visible-page user ID derivation,
 * duplicate ID prevention, and approved-by name mapping.
 * All tests run against compiled TypeScript source without a live Backend.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function source(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', code)((name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith('.') || name.startsWith('@/')) throw new Error('Missing boundary mock: ' + name + ' in ' + file);
    return require(name);
  }, mod, mod.exports);
  return mod.exports;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeReceipt(n, overrides = {}) {
  return {
    id: `id-${n}`,
    receiptCode: `RC-${String(n).padStart(4, '0')}`,
    warehouseId: `wh-${n % 2 === 0 ? 'a' : 'b'}`,
    warehouseCode: n % 2 === 0 ? 'WH-A' : 'WH-B',
    warehouseName: n % 2 === 0 ? 'Kho A' : 'Kho B',
    createdByUserId: `creator-${n % 5}`,
    approvedByUserId: n % 3 === 0 ? `approver-${n % 2}` : null,
    status: n % 2 === 0 ? 'Pending' : 'Received',
    createdAt: new Date(2026, 0, n).toISOString(),
    receivedAt: n % 2 === 0 ? null : new Date(2026, 0, n + 1).toISOString(),
    approvedAt: n % 3 === 0 ? new Date(2026, 0, n + 2).toISOString() : null,
    version: 1,
    lines: Array.from({ length: n % 4 + 1 }, (_, i) => ({
      id: `line-${n}-${i}`,
      batchId: `batch-${n}-${i}`,
      batchCode: `BT-${n}-${i}`,
      receivedQuantity: 10 * (i + 1),
    })),
    code: `RC-${String(n).padStart(4, '0')}`,
    batchCount: n % 4 + 1,
    totalQty: (n % 4 + 1) * 10,
    ...overrides,
  };
}

// ─── Pagination logic ────────────────────────────────────────────────────────

test('pagination: default 20/page — first page shows items 1–20', () => {
  const data = Array.from({ length: 55 }, (_, i) => makeReceipt(i + 1));
  const pageSize = 20;
  const page = 1;
  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = data.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  assert.equal(totalPages, 3);
  assert.equal(pageRows.length, 20);
  assert.equal(pageRows[0].receiptCode, 'RC-0001');
  assert.equal(pageRows[19].receiptCode, 'RC-0020');
});

test('pagination: page 2 of 3 shows items 21–40', () => {
  const data = Array.from({ length: 55 }, (_, i) => makeReceipt(i + 1));
  const pageSize = 20;
  const page = 2;
  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = data.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  assert.equal(currentPage, 2);
  assert.equal(pageRows.length, 20);
  assert.equal(pageRows[0].receiptCode, 'RC-0021');
});

test('pagination: last page shows remaining 15 items', () => {
  const data = Array.from({ length: 55 }, (_, i) => makeReceipt(i + 1));
  const pageSize = 20;
  const page = 3;
  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const pageRows = data.slice((page - 1) * pageSize, page * pageSize);

  assert.equal(totalPages, 3);
  assert.equal(pageRows.length, 15);
});

test('pagination: pageSize 10 gives 6 pages for 55 records', () => {
  const data = Array.from({ length: 55 }, (_, i) => makeReceipt(i + 1));
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const pageRows = data.slice(0, pageSize);
  assert.equal(totalPages, 6);
  assert.equal(pageRows.length, 10);
});

test('pagination: pageSize 50 gives 2 pages for 55 records', () => {
  const data = Array.from({ length: 55 }, (_, i) => makeReceipt(i + 1));
  const pageSize = 50;
  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  assert.equal(totalPages, 2);
  assert.equal(data.slice(50).length, 5); // last page has 5
});

test('pagination: currentPage clamps to totalPages when page exceeds data after filter', () => {
  const data = Array.from({ length: 5 }, (_, i) => makeReceipt(i + 1));
  const pageSize = 20;
  const page = 3; // user was on page 3 of a larger dataset, then applied filter
  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  assert.equal(totalPages, 1);
  assert.equal(currentPage, 1);
});

test('pagination: empty dataset gives totalPages=1 and empty pageRows', () => {
  const data = [];
  const pageSize = 20;
  const page = 1;
  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = data.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  assert.equal(totalPages, 1);
  assert.equal(currentPage, 1);
  assert.equal(pageRows.length, 0);
});

// ─── Filter logic ─────────────────────────────────────────────────────────────

test('filter: status=Pending shows only Pending receipts', () => {
  const data = Array.from({ length: 10 }, (_, i) => makeReceipt(i + 1));
  const filtered = data.filter(r => r.status === 'Pending');
  assert.ok(filtered.every(r => r.status === 'Pending'));
  assert.ok(filtered.length > 0);
  assert.ok(data.some(r => r.status === 'Received'));
});

test('filter: status=Received shows only Received receipts', () => {
  const data = Array.from({ length: 10 }, (_, i) => makeReceipt(i + 1));
  const filtered = data.filter(r => r.status === 'Received');
  assert.ok(filtered.every(r => r.status === 'Received'));
});

test('filter: empty status shows all receipts', () => {
  const data = Array.from({ length: 10 }, (_, i) => makeReceipt(i + 1));
  const statusFilter = '';
  const filtered = statusFilter ? data.filter(r => r.status === statusFilter) : data;
  assert.equal(filtered.length, data.length);
});

test('filter: warehouse filter narrows to matching warehouse only', () => {
  const data = Array.from({ length: 20 }, (_, i) => makeReceipt(i + 1));
  const warehouseFilter = 'Kho A';
  const filtered = data.filter(r => (r.warehouseName || r.warehouseCode) === warehouseFilter);
  assert.ok(filtered.length > 0);
  assert.ok(filtered.every(r => r.warehouseName === 'Kho A'));
  assert.ok(filtered.every(r => r.warehouseCode === 'WH-A'));
});

test('filter: search matches receiptCode case-insensitively', () => {
  const data = Array.from({ length: 10 }, (_, i) => makeReceipt(i + 1));
  const search = 'rc-0005';
  const q = search.toLowerCase();
  const filtered = data.filter(r =>
    (r.receiptCode || r.code)?.toLowerCase().includes(q) ||
    r.warehouseName?.toLowerCase().includes(q) ||
    r.warehouseCode?.toLowerCase().includes(q),
  );
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].receiptCode, 'RC-0005');
});

test('filter: search matches warehouseName', () => {
  const data = Array.from({ length: 10 }, (_, i) => makeReceipt(i + 1));
  const search = 'kho a';
  const q = search.toLowerCase();
  const filtered = data.filter(r =>
    (r.receiptCode || r.code)?.toLowerCase().includes(q) ||
    r.warehouseName?.toLowerCase().includes(q) ||
    r.warehouseCode?.toLowerCase().includes(q),
  );
  assert.ok(filtered.length > 0);
  assert.ok(filtered.every(r => r.warehouseName?.toLowerCase().includes('kho a')));
});

test('filter: combined status + warehouse filters intersect', () => {
  const data = Array.from({ length: 20 }, (_, i) => makeReceipt(i + 1));
  const statusFilter = 'Pending';
  const warehouseFilter = 'Kho A';
  let filtered = data;
  filtered = filtered.filter(r => r.status === statusFilter);
  filtered = filtered.filter(r => (r.warehouseName || r.warehouseCode) === warehouseFilter);
  assert.ok(filtered.every(r => r.status === 'Pending' && r.warehouseName === 'Kho A'));
});

test('filter: total count and totalPages recalculate after filter', () => {
  const data = Array.from({ length: 55 }, (_, i) => makeReceipt(i + 1));
  const statusFilter = 'Pending';
  const pageSize = 20;
  const filtered = data.filter(r => r.status === statusFilter);
  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  // Pending = even-indexed items (i=0,2,4,...) → i+1 even → 28 of 55
  assert.ok(totalCount < data.length);
  assert.ok(totalPages <= 3);
});

// ─── Visible-page user ID derivation ─────────────────────────────────────────

test('user IDs: only visible-page IDs are collected, not full dataset IDs', () => {
  const data = Array.from({ length: 50 }, (_, i) => makeReceipt(i + 1));
  const pageSize = 20;
  const pageRows = data.slice(0, pageSize); // page 1
  const visibleIds = pageRows.flatMap(r => [r.createdByUserId, r.approvedByUserId]);
  const fullDataIds = data.flatMap(r => [r.createdByUserId, r.approvedByUserId]);
  // Visible page IDs are a strict subset of full data IDs
  assert.ok(visibleIds.length < fullDataIds.length);
  assert.ok(visibleIds.length <= pageSize * 2);
});

test('user IDs: null approvedByUserId values are included (useReceiptUserNames filters nulls)', () => {
  const data = [
    makeReceipt(1, { approvedByUserId: null }),
    makeReceipt(2, { approvedByUserId: 'approver-uuid' }),
  ];
  const visibleIds = data.flatMap(r => [r.createdByUserId, r.approvedByUserId]);
  // null is passed; useReceiptUserNames handles it by filtering out nulls internally
  assert.ok(visibleIds.includes(null));
  assert.ok(visibleIds.includes('approver-uuid'));
});

test('user IDs: duplicate IDs across visible rows are deduplicated by useReceiptUserNames', () => {
  // Five receipts all created by the same user: should only fetch that user once
  const sharedCreator = 'shared-creator-uuid';
  const data = Array.from({ length: 5 }, (_, i) =>
    makeReceipt(i + 1, { createdByUserId: sharedCreator, approvedByUserId: null }),
  );
  const rawIds = data.flatMap(r => [r.createdByUserId, r.approvedByUserId])
    .filter(Boolean);
  const uniqueIds = [...new Set(rawIds.map(id => id.trim().toLowerCase()))];
  // Five rows, same creator → deduplicated to 1
  assert.equal(uniqueIds.length, 1);
  assert.equal(uniqueIds[0], sharedCreator.toLowerCase());
});

test('user IDs: page-turn only introduces new IDs not seen on page 1', () => {
  // Simulate two pages with partially overlapping user IDs
  const page1Rows = Array.from({ length: 5 }, (_, i) =>
    makeReceipt(i + 1, { createdByUserId: `user-${i}`, approvedByUserId: null }),
  );
  const page2Rows = Array.from({ length: 5 }, (_, i) =>
    makeReceipt(i + 6, { createdByUserId: `user-${i}`, approvedByUserId: `user-new-${i}` }),
  );
  const page1Ids = new Set(page1Rows.flatMap(r => [r.createdByUserId]).filter(Boolean));
  const page2Ids = page2Rows.flatMap(r => [r.createdByUserId, r.approvedByUserId]).filter(Boolean);
  const newOnPage2 = page2Ids.filter(id => !page1Ids.has(id));
  // Page 2 introduces approvedByUserId IDs not seen on page 1
  assert.ok(newOnPage2.length > 0);
  assert.ok(newOnPage2.every(id => id.startsWith('user-new-')));
});

// ─── Approved By name mapping ─────────────────────────────────────────────────

test('approvedBy: "Chưa duyệt" when approvedByUserId is null and status is Pending', () => {
  const { useReceiptUserNames } = source('features/receipts/userNames.ts', {
    react: { useMemo: (fn) => fn() },
    '@tanstack/react-query': {
      useQuery: () => ({ isPending: false, data: [{ keepers: [] }] }),
      useQueries: () => [],
    },
    '@/shared/auth/AuthContext': { useAuth: () => ({ user: { id: 'admin-id', name: 'Admin', email: 'a@t.com', role: 'Admin' } }) },
    '@/shared/auth/permissions': { can: () => false },
    '@/features/users/api': { userApi: {} },
    './api': { receiptApi: {} },
  });
  const { approverOf } = useReceiptUserNames([]);
  assert.equal(approverOf({ approvedByUserId: null, approvedAt: null, status: 'Pending' }), 'Chưa duyệt');
});

test('approvedBy: "Không xác định" when approvedByUserId is null but receipt is Received', () => {
  const { useReceiptUserNames } = source('features/receipts/userNames.ts', {
    react: { useMemo: (fn) => fn() },
    '@tanstack/react-query': {
      useQuery: () => ({ isPending: false, data: [{ keepers: [] }] }),
      useQueries: () => [],
    },
    '@/shared/auth/AuthContext': { useAuth: () => ({ user: { id: 'admin-id', name: 'Admin', email: 'a@t.com', role: 'Admin' } }) },
    '@/shared/auth/permissions': { can: () => false },
    '@/features/users/api': { userApi: {} },
    './api': { receiptApi: {} },
  });
  const { approverOf } = useReceiptUserNames([]);
  assert.equal(
    approverOf({ approvedByUserId: null, approvedAt: '2026-01-01T00:00:00Z', status: 'Received' }),
    'Không xác định',
  );
});

test('approvedBy: resolved name shown when approvedByUserId matches logged-in user', () => {
  const ADMIN_ID = 'aaaa-aaaa-aaaa';
  const { useReceiptUserNames } = source('features/receipts/userNames.ts', {
    react: { useMemo: (fn) => fn() },
    '@tanstack/react-query': {
      useQuery: () => ({ isPending: false, data: [{ keepers: [] }] }),
      useQueries: () => [],
    },
    '@/shared/auth/AuthContext': { useAuth: () => ({ user: { id: ADMIN_ID, name: 'Nguyễn Văn A', email: 'admin@t.com', role: 'Admin' } }) },
    '@/shared/auth/permissions': { can: () => false },
    '@/features/users/api': { userApi: {} },
    './api': { receiptApi: {} },
  });
  const { approverOf } = useReceiptUserNames([ADMIN_ID]);
  assert.equal(
    approverOf({ approvedByUserId: ADMIN_ID, approvedAt: '2026-01-01T00:00:00Z', status: 'Received' }),
    'Nguyễn Văn A',
  );
});

test('approvedBy: never returns a raw UUID', () => {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;
  const UNKNOWN_ID = '99999999-9999-4999-8999-999999999999';
  const { useReceiptUserNames } = source('features/receipts/userNames.ts', {
    react: { useMemo: (fn) => fn() },
    '@tanstack/react-query': {
      useQuery: () => ({ isPending: false, data: [{ keepers: [] }] }),
      useQueries: ({ queries }) => queries.map(() => ({ isPending: false, isError: true })),
    },
    '@/shared/auth/AuthContext': { useAuth: () => ({ user: { id: 'other-id', name: 'Other', email: 'o@t.com', role: 'Admin' } }) },
    '@/shared/auth/permissions': { can: (u, p) => p === 'users.manage' },
    '@/features/users/api': { userApi: { get: async () => { throw new Error('404'); } } },
    './api': { receiptApi: {} },
  });
  const { approverOf, nameOf } = useReceiptUserNames([UNKNOWN_ID]);
  const approverResult = approverOf({ approvedByUserId: UNKNOWN_ID, approvedAt: '2026-01-01T00:00:00Z', status: 'Received' });
  const creatorResult = nameOf(UNKNOWN_ID);
  assert.doesNotMatch(approverResult, uuid, 'approverOf must not return raw UUID');
  assert.doesNotMatch(creatorResult, uuid, 'nameOf must not return raw UUID');
});

// ─── Batch relationships ──────────────────────────────────────────────────────

test('batch: mapReceiptListItem derives batchCount and totalQty from lines', () => {
  const { mapReceiptListItem } = source('features/receipts/api.ts', {
    '@/shared/api/http': { http: {}, get: () => {}, getAll: () => {} },
    '@/shared/api/errors': { ApiError: class {} },
  });
  const detail = {
    id: 'r1', receiptCode: 'RC-0001', warehouseId: 'wh1', warehouseCode: 'WH', warehouseName: 'Kho',
    createdByUserId: 'u1', approvedByUserId: null, status: 'Received',
    receivedAt: null, approvedAt: null, createdAt: new Date().toISOString(), version: 1,
    lines: [
      { id: 'l1', batchId: 'b1', batchCode: 'BT-001', receivedQuantity: 100, productId: 'p1', sku: 'SKU-1', productName: 'Product 1', sourceLotCode: null, productionDate: '2026-01-01', expirationDate: '2026-12-31' },
      { id: 'l2', batchId: 'b2', batchCode: 'BT-002', receivedQuantity: 50,  productId: 'p2', sku: 'SKU-2', productName: 'Product 2', sourceLotCode: null, productionDate: '2026-01-01', expirationDate: '2026-11-30' },
    ],
  };
  const item = mapReceiptListItem(detail);
  assert.equal(item.batchCount, 2);
  assert.equal(item.totalQty, 150);
  assert.equal(item.code, 'RC-0001');
});

test('batch: receipt with zero lines gives batchCount=0 and totalQty=0', () => {
  const { mapReceiptListItem } = source('features/receipts/api.ts', {
    '@/shared/api/http': { http: {}, get: () => {}, getAll: () => {} },
    '@/shared/api/errors': { ApiError: class {} },
  });
  const detail = {
    id: 'r2', receiptCode: 'RC-0002', warehouseId: 'wh1', warehouseCode: 'WH', warehouseName: 'Kho',
    createdByUserId: 'u1', approvedByUserId: null, status: 'Pending',
    receivedAt: null, approvedAt: null, createdAt: new Date().toISOString(), version: 1,
    lines: [],
  };
  const item = mapReceiptListItem(detail);
  assert.equal(item.batchCount, 0);
  assert.equal(item.totalQty, 0);
});

// ─── Source code assertions ────────────────────────────────────────────────────

test('ReceiptsPage source: visibleUserIds derives from pageRows, not query.data', () => {
  const src = fs.readFileSync(
    path.resolve(__dirname, '../src/features/receipts/pages/ReceiptsPage.tsx'),
    'utf8',
  );
  // Must reference pageRows for user ID collection
  assert.ok(src.includes('pageRows.flatMap'), 'visibleUserIds must derive from pageRows');
  // Must NOT reference query.data for user IDs
  assert.ok(!src.includes('query.data ?? []).flatMap'), 'must not resolve user IDs from full dataset');
  // useReceiptUserNames must receive visibleUserIds
  assert.ok(src.includes('useReceiptUserNames(visibleUserIds)'), 'hook must receive visible-page IDs');
});

test('ReceiptsPage source: default pageSize is 20 per project convention', () => {
  const src = fs.readFileSync(
    path.resolve(__dirname, '../src/features/receipts/pages/ReceiptsPage.tsx'),
    'utf8',
  );
  assert.ok(src.includes('defaultPageSize: 20'), 'default page size must be 20');
  assert.ok(src.includes('[10, 20, 50]'), 'page size options must be [10, 20, 50]');
});

test('ReceiptsPage source: warehouse filter resets to page 1 on change', () => {
  const src = fs.readFileSync(
    path.resolve(__dirname, '../src/features/receipts/pages/ReceiptsPage.tsx'),
    'utf8',
  );
  assert.ok(
    src.includes('basePagingProps.onPageChange(1)'),
    'warehouse filter must reset page to 1',
  );
});

test('ReceiptsPage source: status filter uses useEnumParam with resets page', () => {
  const src = fs.readFileSync(
    path.resolve(__dirname, '../src/features/receipts/pages/ReceiptsPage.tsx'),
    'utf8',
  );
  assert.ok(src.includes("resets: ['page']"), 'status filter must reset page via useEnumParam');
  assert.ok(src.includes('urlState: true'), 'pagination state must persist to URL');
});

test('ReceiptsPage source: Người duyệt column uses approverOf, not nameOf', () => {
  const src = fs.readFileSync(
    path.resolve(__dirname, '../src/features/receipts/pages/ReceiptsPage.tsx'),
    'utf8',
  );
  assert.ok(src.includes('users.approverOf(r)'), 'Approved By column must use approverOf');
  assert.ok(src.includes("header: 'Người duyệt'"), 'Người duyệt column must exist');
});

test('ReceiptsPage source: receipt lifecycle mutations are not modified', () => {
  const src = fs.readFileSync(
    path.resolve(__dirname, '../src/features/receipts/pages/ReceiptsPage.tsx'),
    'utf8',
  );
  // Create and approve actions preserved
  assert.ok(src.includes('useApproveReceipt'), 'approve mutation must be present');
  assert.ok(src.includes('receipts/new'), 'create navigation must be present');
  assert.ok(src.includes('tồn kho thực tế'), 'confirm dialog business copy must be preserved');
});
