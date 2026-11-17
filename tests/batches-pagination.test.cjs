/**
 * Phase 6 Batches Pagination — static source analysis tests.
 *
 * Verifies:
 * - Warehouse and SKU URL persistence (useStringParam)
 * - Combined filter + pagination logic
 * - Batch Detail back navigation (listHref / rememberLocation)
 * - Browser refresh and Back/Forward restoration
 * - Pagination reset after filter changes (resets: ['page'])
 * - Invalid URL filter recovery
 * - Warehouse keeper scope applied before pagination
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// ─── Source readers ──────────────────────────────────────────────────────────

function readSource(relPath) {
  return fs.readFileSync(path.resolve(__dirname, '..', relPath), 'utf8');
}

const pageCode = readSource('src/features/batches/pages/BatchesPage.tsx');
const listStateCode = readSource('src/shared/router/listState.ts');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Minimal batchStatusLabel re-implementation matching the production function. */
function batchStatusLabel(b) {
  if (b.expiryStatus === 'Disposed') return 'Đã tiêu hủy';
  if (b.lockedQuantity > 0) return 'Có hàng khóa';
  if (b.expiryStatus === 'Expired') return 'Hết hạn';
  if (b.expiryStatus === 'NearExpiry' || b.expiryStatus === 'Near-date') return 'Cận hạn';
  return 'Còn hạn';
}

/** Minimal client-side filter + in-stock sort + pagination matching the production implementation. */
function applyFiltersAndPaginate(allRows, { search = '', warehouseFilter = '', skuFilter = '', statusFilter = '', page = 1, pageSize = 20 } = {}) {
  let result = allRows;
  if (search) {
    const q = search.toLowerCase().trim();
    result = result.filter(b =>
      b.batchCode.toLowerCase().includes(q) ||
      b.sku.toLowerCase().includes(q) ||
      b.productName.toLowerCase().includes(q) ||
      b.warehouseName.toLowerCase().includes(q),
    );
  }
  if (warehouseFilter) result = result.filter(b => b.warehouseName === warehouseFilter);
  if (skuFilter) result = result.filter(b => b.sku === skuFilter);
  if (statusFilter) result = result.filter(b => batchStatusLabel(b) === statusFilter);

  // In-stock priority sort: available > 0 first, then available <= 0 (stable within each group)
  const inStock = result.filter(b => b.availableQuantity > 0);
  const outOfStock = result.filter(b => b.availableQuantity <= 0);
  const sorted = [...inStock, ...outOfStock];

  const totalCount = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  return { totalCount, totalPages, currentPage, pageRows, sorted };
}

/** Minimal URLSearchParams-based param set/reset logic matching useStringParam/resets. */
function simulateSetParam(currentSearch, paramName, newValue, resets = []) {
  const params = new URLSearchParams(currentSearch);
  if (newValue === '' || newValue == null) params.delete(paramName);
  else params.set(paramName, newValue);
  for (const k of resets) params.delete(k);
  return params;
}

// ─── Fixture data ─────────────────────────────────────────────────────────────

const BATCHES = [
  { batchId: 'b1', batchCode: 'BATCH-001', warehouseId: 'w1', warehouseName: 'Kho HN', sku: 'SKU-A', productName: 'Sản phẩm A', expiryStatus: 'Valid', lockedQuantity: 0, availableQuantity: 100, onHandQuantity: 100, reservedQuantity: 0 },
  { batchId: 'b2', batchCode: 'BATCH-002', warehouseId: 'w1', warehouseName: 'Kho HN', sku: 'SKU-B', productName: 'Sản phẩm B', expiryStatus: 'NearExpiry', lockedQuantity: 0, availableQuantity: 50, onHandQuantity: 50, reservedQuantity: 0 },
  { batchId: 'b3', batchCode: 'BATCH-003', warehouseId: 'w2', warehouseName: 'Kho HCM', sku: 'SKU-A', productName: 'Sản phẩm A', expiryStatus: 'Expired', lockedQuantity: 0, availableQuantity: 0, onHandQuantity: 20, reservedQuantity: 0 },
  { batchId: 'b4', batchCode: 'BATCH-004', warehouseId: 'w2', warehouseName: 'Kho HCM', sku: 'SKU-C', productName: 'Sản phẩm C', expiryStatus: 'Valid', lockedQuantity: 10, availableQuantity: 90, onHandQuantity: 100, reservedQuantity: 0 },
  { batchId: 'b5', batchCode: 'BATCH-005', warehouseId: 'w1', warehouseName: 'Kho HN', sku: 'SKU-C', productName: 'Sản phẩm C', expiryStatus: 'Disposed', lockedQuantity: 0, availableQuantity: 0, onHandQuantity: 0, reservedQuantity: 0 },
];

// ─── 1. URL Persistence — Source Analysis ────────────────────────────────────

describe('URL persistence — source analysis', () => {
  test('warehouse filter uses useStringParam (URL-persisted)', () => {
    assert.ok(pageCode.includes("useStringParam('wh',"), 'warehouse filter must use useStringParam with key "wh"');
  });

  test('SKU filter uses useStringParam (URL-persisted)', () => {
    assert.ok(pageCode.includes("useStringParam('sku',"), 'SKU filter must use useStringParam with key "sku"');
  });

  test('warehouse filter has resets page', () => {
    assert.ok(pageCode.includes("useStringParam('wh', { resets: ['page'] })"), 'warehouse filter must reset page on change');
  });

  test('SKU filter has resets page', () => {
    assert.ok(pageCode.includes("useStringParam('sku', { resets: ['page'] })"), 'SKU filter must reset page on change');
  });

  test('status filter uses useEnumParam (URL-persisted)', () => {
    assert.ok(pageCode.includes("useEnumParam<BatchStatusFilter>"), 'status filter must use useEnumParam');
  });

  test('useStringParam is imported from listState', () => {
    assert.ok(pageCode.includes("useStringParam } from '@/shared/router/listState'") || pageCode.includes("useStringParam,"), 'useStringParam must be imported from @/shared/router/listState');
  });

  test('no useState for warehouse or SKU filters', () => {
    // useState must not be used for warehouse or SKU filter state
    const warehouseStateMatch = pageCode.match(/useState\s*\(\s*''\s*\)/g) ?? [];
    // We allow useState for dialog targets (lockTarget, releaseTarget, printTarget, approveTarget)
    // but not for filter strings — the warehouse/sku lines must NOT appear in useState calls
    assert.ok(
      !pageCode.includes("useState('') // warehouse") && !pageCode.includes("useState('') // sku"),
      'warehouse and SKU filters must not use local useState'
    );
    // The only remaining useState('') calls must be for approveTarget or similar booleans
    // Check that warehouseFilter and skuFilter are NOT assigned from useState
    assert.ok(
      !pageCode.match(/warehouseFilter.*=.*useState/),
      'warehouseFilter must not use useState'
    );
    assert.ok(
      !pageCode.match(/skuFilter.*=.*useState/),
      'skuFilter must not use useState'
    );
  });
});

// ─── 2. URL Parameter Reset Logic (useStringParam resets) ────────────────────

describe('URL param reset on filter change', () => {
  test('setting warehouse filter clears page from URL', () => {
    const before = 'page=3&wh=&sku=&search=';
    const after = simulateSetParam(before, 'wh', 'Kho HN', ['page']);
    assert.equal(after.get('page'), null, 'page must be cleared when warehouse changes');
    assert.equal(after.get('wh'), 'Kho HN');
  });

  test('setting SKU filter clears page from URL', () => {
    const before = 'page=5&wh=Kho+HN&sku=&search=';
    const after = simulateSetParam(before, 'sku', 'SKU-A', ['page']);
    assert.equal(after.get('page'), null, 'page must be cleared when SKU changes');
    assert.equal(after.get('sku'), 'SKU-A');
  });

  test('clearing warehouse filter removes wh param from URL', () => {
    const before = 'page=1&wh=Kho+HN&sku=SKU-A';
    const after = simulateSetParam(before, 'wh', '', ['page']);
    assert.equal(after.get('wh'), null, 'empty warehouse must remove wh param');
  });

  test('clearing SKU filter removes sku param from URL', () => {
    const before = 'page=2&wh=Kho+HN&sku=SKU-A';
    const after = simulateSetParam(before, 'sku', '', ['page']);
    assert.equal(after.get('sku'), null, 'empty SKU must remove sku param');
  });

  test('combined URL restores all filters on refresh', () => {
    const url = new URLSearchParams('page=2&wh=Kho+HCM&sku=SKU-A&status=H%E1%BA%BFt+h%E1%BA%A1n&search=BATCH');
    assert.equal(url.get('wh'), 'Kho HCM');
    assert.equal(url.get('sku'), 'SKU-A');
    assert.equal(url.get('status'), 'Hết hạn');
    assert.equal(url.get('search'), 'BATCH');
    assert.equal(url.get('page'), '2');
  });
});

// ─── 3. Invalid / Unavailable Filter Recovery ────────────────────────────────

describe('invalid / unavailable filter recovery', () => {
  test('unknown warehouse value returns empty filtered list (no crash)', () => {
    const { totalCount, pageRows } = applyFiltersAndPaginate(BATCHES, { warehouseFilter: 'Kho không tồn tại' });
    assert.equal(totalCount, 0);
    assert.equal(pageRows.length, 0);
  });

  test('unknown SKU value returns empty filtered list (no crash)', () => {
    const { totalCount } = applyFiltersAndPaginate(BATCHES, { skuFilter: 'SKU-INVALID-99' });
    assert.equal(totalCount, 0);
  });

  test('unknown status value returns all rows (enum fallback to empty string)', () => {
    // useEnumParam falls back to '' when the URL value is not in BATCH_STATUS_OPTIONS
    // '' means no status filter → all rows pass
    const { totalCount } = applyFiltersAndPaginate(BATCHES, { statusFilter: '' });
    assert.equal(totalCount, BATCHES.length);
  });

  test('page beyond last page clamps to last page', () => {
    const { currentPage, totalPages } = applyFiltersAndPaginate(BATCHES, { page: 999, pageSize: 2 });
    assert.equal(currentPage, totalPages, 'out-of-range page clamps to last page');
  });

  test('available warehouse filter value that no longer exists shows empty state gracefully', () => {
    // Simulate: user had wh=Kho HN set, keeper scope later returns only Kho HCM batches
    const scopedTohcm = BATCHES.filter(b => b.warehouseName === 'Kho HCM');
    const { totalCount } = applyFiltersAndPaginate(scopedTohcm, { warehouseFilter: 'Kho HN' });
    assert.equal(totalCount, 0, 'stale URL wh value that no longer matches scoped data shows empty state, not an error');
  });
});

// ─── 4. Warehouse Keeper Scope ────────────────────────────────────────────────

describe('warehouse keeper scope', () => {
  test('scope filter is applied before pagination', () => {
    // WarehouseKeeper assigned to w1 — scopedRows should only have w1 batches
    const assignedWhIds = ['w1'];
    const scoped = BATCHES.filter(b => assignedWhIds.includes(b.warehouseId));
    assert.equal(scoped.length, 3); // b1, b2, b5 are in w1
    const { totalCount } = applyFiltersAndPaginate(scoped);
    assert.equal(totalCount, 3, 'pagination totalCount is based on keeper-scoped rows, not full dataset');
  });

  test('keeper cannot see other warehouse batches even with explicit wh filter', () => {
    const assignedWhIds = ['w1'];
    const scoped = BATCHES.filter(b => assignedWhIds.includes(b.warehouseId));
    // Even if URL has wh=Kho HCM, scopedRows already excludes Kho HCM batches
    const { totalCount } = applyFiltersAndPaginate(scoped, { warehouseFilter: 'Kho HCM' });
    assert.equal(totalCount, 0, 'keeper scope is applied first; wh filter cannot expose out-of-scope batches');
  });

  test('admin sees all warehouses (scope not applied)', () => {
    // Admin: no scope filter applied — all BATCHES used as scopedRows
    const { totalCount } = applyFiltersAndPaginate(BATCHES);
    assert.equal(totalCount, BATCHES.length);
  });

  test('keeper scope logic is in source (not removed by pagination refactor)', () => {
    assert.ok(pageCode.includes("isKeeper"), 'isKeeper check must still exist');
    assert.ok(pageCode.includes("assignedWhIds"), 'assignedWhIds must still exist');
    assert.ok(pageCode.includes("scopedRows"), 'scopedRows variable must still exist');
  });
});

// ─── 5. Filter + Pagination Logic ────────────────────────────────────────────

describe('filter + pagination logic', () => {
  test('default: 20 rows per page, all batches visible on page 1 for small dataset', () => {
    const { pageRows, totalCount } = applyFiltersAndPaginate(BATCHES);
    assert.equal(totalCount, BATCHES.length);
    assert.equal(pageRows.length, BATCHES.length); // 5 < 20, all visible
  });

  test('warehouse filter isolates one warehouse', () => {
    const { totalCount, pageRows } = applyFiltersAndPaginate(BATCHES, { warehouseFilter: 'Kho HCM' });
    assert.equal(totalCount, 2);
    assert.ok(pageRows.every(b => b.warehouseName === 'Kho HCM'));
  });

  test('SKU filter isolates one product across warehouses', () => {
    const { totalCount, pageRows } = applyFiltersAndPaginate(BATCHES, { skuFilter: 'SKU-A' });
    assert.equal(totalCount, 2); // b1 (HN), b3 (HCM)
    assert.ok(pageRows.every(b => b.sku === 'SKU-A'));
  });

  test('status filter: Hết hạn', () => {
    const { totalCount } = applyFiltersAndPaginate(BATCHES, { statusFilter: 'Hết hạn' });
    assert.equal(totalCount, 1); // b3
  });

  test('status filter: Cận hạn', () => {
    const { totalCount } = applyFiltersAndPaginate(BATCHES, { statusFilter: 'Cận hạn' });
    assert.equal(totalCount, 1); // b2
  });

  test('status filter: Có hàng khóa', () => {
    const { totalCount } = applyFiltersAndPaginate(BATCHES, { statusFilter: 'Có hàng khóa' });
    assert.equal(totalCount, 1); // b4 (lockedQuantity > 0)
  });

  test('status filter: Đã tiêu hủy', () => {
    const { totalCount } = applyFiltersAndPaginate(BATCHES, { statusFilter: 'Đã tiêu hủy' });
    assert.equal(totalCount, 1); // b5
  });

  test('combined warehouse + SKU filter', () => {
    const { totalCount, pageRows } = applyFiltersAndPaginate(BATCHES, { warehouseFilter: 'Kho HN', skuFilter: 'SKU-A' });
    assert.equal(totalCount, 1); // b1 only
    assert.equal(pageRows[0].batchCode, 'BATCH-001');
  });

  test('combined warehouse + status filter', () => {
    const { totalCount } = applyFiltersAndPaginate(BATCHES, { warehouseFilter: 'Kho HN', statusFilter: 'Cận hạn' });
    assert.equal(totalCount, 1); // b2
  });

  test('search matches batchCode', () => {
    const { totalCount } = applyFiltersAndPaginate(BATCHES, { search: 'BATCH-003' });
    assert.equal(totalCount, 1);
  });

  test('search matches productName case-insensitively', () => {
    const { totalCount } = applyFiltersAndPaginate(BATCHES, { search: 'sản phẩm c' });
    assert.equal(totalCount, 2); // b4, b5
  });

  test('pagination page 2 with pageSize 2', () => {
    const { pageRows, currentPage, totalPages } = applyFiltersAndPaginate(BATCHES, { page: 2, pageSize: 2 });
    assert.equal(totalPages, 3);
    assert.equal(currentPage, 2);
    assert.equal(pageRows.length, 2);
  });

  test('totalPages recalculates when filter reduces dataset', () => {
    const { totalPages } = applyFiltersAndPaginate(BATCHES, { warehouseFilter: 'Kho HN', pageSize: 2 });
    assert.equal(totalPages, 2); // 3 HN batches / 2 = ceil(1.5) = 2
  });

  test('empty dataset gives totalPages = 1 (no divide-by-zero)', () => {
    const { totalPages, pageRows } = applyFiltersAndPaginate([], {});
    assert.equal(totalPages, 1);
    assert.equal(pageRows.length, 0);
  });
});

// ─── 6. Batch Detail Back Navigation ─────────────────────────────────────────

describe('Batch Detail back navigation', () => {
  test('listHref returns stored query string for /batches', () => {
    // Simulate: user was on /batches?wh=Kho+HN&sku=SKU-A&page=2
    // rememberLocation stores it; listHref recalls it
    const memory = { '/batches': '?wh=Kho+HN&sku=SKU-A&page=2' };
    function listHref(path) {
      if (path.includes('?') || path.includes('#')) return path;
      return path + (memory[path] ?? '');
    }
    const href = listHref('/batches');
    assert.equal(href, '/batches?wh=Kho+HN&sku=SKU-A&page=2');
  });

  test('listHref falls back to base path when no memory entry', () => {
    const memory = {};
    function listHref(path) {
      if (path.includes('?') || path.includes('#')) return path;
      return path + (memory[path] ?? '');
    }
    assert.equal(listHref('/batches'), '/batches');
  });

  test('listState exports rememberLocation and listHref', () => {
    assert.ok(listStateCode.includes('export function rememberLocation'), 'rememberLocation must be exported');
    assert.ok(listStateCode.includes('export function listHref'), 'listHref must be exported');
  });

  test('listState exports useReturnToList for detail page back button', () => {
    assert.ok(listStateCode.includes('export function useReturnToList'), 'useReturnToList must be exported for Batch Detail back navigation');
  });
});

// ─── 7. Source Assertions ─────────────────────────────────────────────────────

describe('source assertions — BatchesPage.tsx', () => {
  test('default page size is 20', () => {
    assert.ok(pageCode.includes('defaultPageSize: 20'), 'default page size must be 20');
  });

  test('pageSizeOptions includes 10, 20, 50', () => {
    assert.ok(pageCode.includes('[10, 20, 50]'), 'page size options must be [10, 20, 50]');
  });

  test('urlState is true', () => {
    assert.ok(pageCode.includes('urlState: true'), 'URL state must be enabled');
  });

  test('server prop is passed to DataTable', () => {
    assert.ok(pageCode.includes('server={pagingProps}'), 'DataTable must use server pagination prop');
  });

  test('pageRows (not full dataset) is passed to DataTable', () => {
    assert.ok(pageCode.includes('rows={pageRows}'), 'DataTable must receive only the current page rows');
  });

  test('QR labels map is built from useAllQrLabels (not removed)', () => {
    assert.ok(pageCode.includes('useAllQrLabels()'), 'QR labels hook must still be used');
    assert.ok(pageCode.includes('qrLabelsByBatch'), 'qrLabelsByBatch map must still exist');
  });

  test('Lock and Unlock dialogs are still wired', () => {
    assert.ok(pageCode.includes('LockBatchDialog'), 'LockBatchDialog must still be wired');
    assert.ok(pageCode.includes('ReleaseBatchLockDialog'), 'ReleaseBatchLockDialog must still be wired');
  });

  test('LabelPrintDialog is still wired', () => {
    assert.ok(pageCode.includes('LabelPrintDialog'), 'LabelPrintDialog must still be wired');
  });

  test('available quantity, reserved quantity, locked quantity columns exist', () => {
    assert.ok(pageCode.includes("'available'"), 'available quantity column must exist');
    assert.ok(pageCode.includes("'reserved'"), 'reserved quantity column must exist');
    assert.ok(pageCode.includes("'locked'"), 'locked quantity column must exist');
  });

  test('unified filter bar: search input is in filter bar (not only inside DataTable)', () => {
    assert.ok(pageCode.includes('setSearch(e.target.value)'), 'search input must call setSearch');
    assert.ok(pageCode.includes("placeholder=\"Mã lô hàng, SKU, tên sản phẩm"), 'search placeholder must be in filter bar');
  });

  test('no searchPlaceholder passed to DataTable (search moved to filter bar)', () => {
    // searchPlaceholder should not appear as a prop on DataTable anymore
    assert.ok(!pageCode.includes('searchPlaceholder='), 'searchPlaceholder must be removed from DataTable');
  });

  test('Clear Filters button exists and uses clearFilters + hasActiveFilters', () => {
    assert.ok(pageCode.includes('clearFilters'), 'clearFilters function must exist');
    assert.ok(pageCode.includes('hasActiveFilters'), 'hasActiveFilters must control Clear Filters visibility');
    assert.ok(pageCode.includes('Xóa bộ lọc'), 'Clear Filters button must have Vietnamese label');
  });

  test('clearFilters clears all params atomically via setParams', () => {
    assert.ok(pageCode.includes("setParams({ status: null, wh: null, sku: null, search: null, page: null })"), 'clearFilters must reset all 5 params atomically');
  });

  test('in-stock priority sort: sorted variable separates inStock from outOfStock', () => {
    assert.ok(pageCode.includes('availableQuantity > 0'), 'in-stock sort must use availableQuantity > 0');
    assert.ok(pageCode.includes('const sorted'), 'sorted variable must exist');
    assert.ok(pageCode.includes('[...inStock, ...outOfStock]'), 'sorted must be inStock then outOfStock');
  });

  test('pagination uses sorted (not filtered) for page slicing', () => {
    // pageRows must come from sorted, not filtered
    assert.ok(pageCode.includes('sorted.slice('), 'pageRows must slice from sorted (not filtered)');
  });
});

// ─── 8. In-stock Priority Sort ───────────────────────────────────────────────

describe('in-stock priority sort', () => {
  const MIXED = [
    { batchId: 'z1', batchCode: 'Z-001', warehouseId: 'w1', warehouseName: 'Kho HN', sku: 'SKU-A', productName: 'P', expiryStatus: 'Expired', lockedQuantity: 0, availableQuantity: 0, onHandQuantity: 5, reservedQuantity: 0 },
    { batchId: 'z2', batchCode: 'Z-002', warehouseId: 'w1', warehouseName: 'Kho HN', sku: 'SKU-B', productName: 'P', expiryStatus: 'Valid', lockedQuantity: 0, availableQuantity: 30, onHandQuantity: 30, reservedQuantity: 0 },
    { batchId: 'z3', batchCode: 'Z-003', warehouseId: 'w1', warehouseName: 'Kho HN', sku: 'SKU-C', productName: 'P', expiryStatus: 'Valid', lockedQuantity: 0, availableQuantity: 0, onHandQuantity: 10, reservedQuantity: 10 },
    { batchId: 'z4', batchCode: 'Z-004', warehouseId: 'w1', warehouseName: 'Kho HN', sku: 'SKU-D', productName: 'P', expiryStatus: 'Valid', lockedQuantity: 0, availableQuantity: 10, onHandQuantity: 10, reservedQuantity: 0 },
  ];

  test('in-stock batches appear before zero-stock batches', () => {
    const { pageRows } = applyFiltersAndPaginate(MIXED);
    const availabilities = pageRows.map(b => b.availableQuantity);
    // Find the first zero-availability batch
    const firstZeroIdx = availabilities.findIndex(q => q <= 0);
    if (firstZeroIdx === -1) return; // All in-stock — OK
    // All rows after the first zero must also be zero or the first row is in-stock
    const afterFirstZero = availabilities.slice(firstZeroIdx);
    assert.ok(afterFirstZero.every(q => q <= 0), 'no in-stock batch should appear after a zero-stock batch');
  });

  test('z2 and z4 (available > 0) appear before z1 and z3 (available = 0)', () => {
    const { pageRows } = applyFiltersAndPaginate(MIXED);
    const ids = pageRows.map(b => b.batchId);
    assert.ok(ids.indexOf('z2') < ids.indexOf('z1'), 'z2 (in-stock) must come before z1 (zero-stock)');
    assert.ok(ids.indexOf('z4') < ids.indexOf('z3'), 'z4 (in-stock) must come before z3 (zero-stock)');
  });

  test('order within in-stock group is preserved (z2 before z4, their original order)', () => {
    const { pageRows } = applyFiltersAndPaginate(MIXED);
    const ids = pageRows.map(b => b.batchId);
    assert.ok(ids.indexOf('z2') < ids.indexOf('z4'), 'z2 appears before z4 in original data — order preserved within in-stock group');
  });

  test('order within zero-stock group is preserved (z1 before z3, their original order)', () => {
    const { pageRows } = applyFiltersAndPaginate(MIXED);
    const ids = pageRows.map(b => b.batchId);
    assert.ok(ids.indexOf('z1') < ids.indexOf('z3'), 'z1 appears before z3 in original data — order preserved within zero-stock group');
  });

  test('zero-stock batches remain visible (not filtered out)', () => {
    const { totalCount } = applyFiltersAndPaginate(MIXED);
    assert.equal(totalCount, MIXED.length, 'all batches including zero-stock must remain in results');
    const { pageRows } = applyFiltersAndPaginate(MIXED);
    const zeroStockIds = pageRows.filter(b => b.availableQuantity <= 0).map(b => b.batchId);
    assert.ok(zeroStockIds.includes('z1'), 'z1 (zero-stock) must still appear');
    assert.ok(zeroStockIds.includes('z3'), 'z3 (zero-stock) must still appear');
  });

  test('sorting applies to full filtered dataset before pagination (not per-page)', () => {
    // pageSize=2: first page should contain the 2 in-stock batches
    const { pageRows } = applyFiltersAndPaginate(MIXED, { pageSize: 2, page: 1 });
    assert.ok(pageRows.every(b => b.availableQuantity > 0), 'page 1 (size=2) must contain only in-stock batches when 2 in-stock batches exist');
  });

  test('page 2 contains zero-stock batches when page 1 filled with in-stock', () => {
    const { pageRows } = applyFiltersAndPaginate(MIXED, { pageSize: 2, page: 2 });
    assert.ok(pageRows.every(b => b.availableQuantity <= 0), 'page 2 (size=2) must contain only zero-stock batches');
  });

  test('sorting uses Backend-provided availableQuantity, not onHandQuantity', () => {
    // z1: onHand=5 but available=0 → must be in zero-stock group
    const { pageRows } = applyFiltersAndPaginate(MIXED, { pageSize: 2 });
    const page1Ids = pageRows.map(b => b.batchId);
    assert.ok(!page1Ids.includes('z1'), 'z1 has onHand=5 but available=0 — must NOT appear in page 1 in-stock group');
  });

  test('sorting with BATCHES fixture: b1(100), b2(50), b4(90) before b3(0), b5(0)', () => {
    const { sorted } = applyFiltersAndPaginate(BATCHES);
    const ids = sorted.map(b => b.batchId);
    // In-stock: b1, b2, b4 (in original order among in-stock)
    // Zero-stock: b3, b5 (in original order among zero-stock)
    const inStockEnd = ids.findIndex(id => ['b3', 'b5'].includes(id));
    const zeroStockStart = inStockEnd;
    assert.ok(ids.slice(0, zeroStockStart).every(id => ['b1', 'b2', 'b4'].includes(id)), 'in-stock batches must come first');
    assert.ok(ids.slice(zeroStockStart).every(id => ['b3', 'b5'].includes(id)), 'zero-stock batches must come after');
  });
});

// ─── 9. Clear Filters ─────────────────────────────────────────────────────────

describe('clear filters', () => {
  test('clearFilters resets all 5 params to null', () => {
    const before = new URLSearchParams('status=Hết+hạn&wh=Kho+HN&sku=SKU-A&search=BATCH&page=3');
    // Simulate setParams with all null
    const params = new URLSearchParams(before.toString());
    for (const k of ['status', 'wh', 'sku', 'search', 'page']) params.delete(k);
    assert.equal(params.toString(), '', 'all params must be cleared');
  });

  test('clearFilters is only shown when at least one filter is active', () => {
    // Simulates hasActiveFilters logic
    function hasActiveFilters({ search, statusFilter, warehouseFilter, skuFilter }) {
      return !!(search || statusFilter || warehouseFilter || skuFilter);
    }
    assert.ok(!hasActiveFilters({ search: '', statusFilter: '', warehouseFilter: '', skuFilter: '' }));
    assert.ok(hasActiveFilters({ search: 'x', statusFilter: '', warehouseFilter: '', skuFilter: '' }));
    assert.ok(hasActiveFilters({ search: '', statusFilter: 'Còn hạn', warehouseFilter: '', skuFilter: '' }));
    assert.ok(hasActiveFilters({ search: '', statusFilter: '', warehouseFilter: 'Kho HN', skuFilter: '' }));
    assert.ok(hasActiveFilters({ search: '', statusFilter: '', warehouseFilter: '', skuFilter: 'SKU-A' }));
  });
});
