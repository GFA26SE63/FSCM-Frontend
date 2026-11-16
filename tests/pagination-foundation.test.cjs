const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function source(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const module = { exports: {} };
  const imports = (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith('./') || name.startsWith('../')) {
      const resolved = path.relative(path.resolve(__dirname, '../src'), path.resolve(path.dirname(filename), name)).replace(/\\/g, '/');
      const tsPath = resolved.endsWith('.ts') || resolved.endsWith('.tsx') ? resolved : `${resolved}.ts`;
      if (fs.existsSync(path.resolve(__dirname, '../src', tsPath))) {
        return source(tsPath, mocks);
      }
    }
    if (name.startsWith('@/')) {
      const sub = name.slice(2);
      const tsPath = sub.endsWith('.ts') || sub.endsWith('.tsx') ? sub : `${sub}.ts`;
      if (fs.existsSync(path.resolve(__dirname, '../src', tsPath))) {
        return source(tsPath, mocks);
      }
    }
    return require(name);
  };
  new Function('require', 'module', 'exports', code)(imports, module, module.exports);
  return module.exports;
}

class MemoryStorage {
  constructor() {
    this.map = new Map();
  }
  getItem(k) {
    return this.map.has(k) ? this.map.get(k) : null;
  }
  setItem(k, v) {
    this.map.set(k, String(v));
  }
  removeItem(k) {
    this.map.delete(k);
  }
}

beforeEach(() => {
  globalThis.sessionStorage = new MemoryStorage();
});

const urlSync = source('shared/pagination/urlSync.ts');
const queryKeys = source('shared/pagination/queryKeys.ts');

/* ------------------------------------------------------------------ */
/* 1. URL Sync & Reset Rules Tests                                    */
/* ------------------------------------------------------------------ */

test('URL State: PAGINATION_RESETS includes page, after, and before', () => {
  assert.deepEqual(urlSync.PAGINATION_RESETS, ['page', 'after', 'before']);
});

test('URL State: parsePageSize enforces allowed list and safe defaults', () => {
  assert.equal(urlSync.parsePageSize('20'), 20);
  assert.equal(urlSync.parsePageSize('50'), 50);
  assert.equal(urlSync.parsePageSize('10'), 10);
  // Unallowed or malformed values fall back to default
  assert.equal(urlSync.parsePageSize('100'), 10);
  assert.equal(urlSync.parsePageSize('0'), 10);
  assert.equal(urlSync.parsePageSize('-5'), 10);
  assert.equal(urlSync.parsePageSize('abc'), 10);
  assert.equal(urlSync.parsePageSize(null), 10);
  assert.equal(urlSync.parsePageSize(undefined, [10, 20, 50], 20), 20);
});

test('URL State: encodeSort and decodeSort round-trip canonical format', () => {
  assert.equal(urlSync.encodeSort('createdAt', 'desc'), 'createdAt:desc');
  assert.equal(urlSync.encodeSort('code', 'asc'), 'code:asc');
  assert.equal(urlSync.encodeSort(undefined), null);

  assert.deepEqual(urlSync.decodeSort('createdAt:desc'), { field: 'createdAt', direction: 'desc' });
  assert.deepEqual(urlSync.decodeSort('name:asc'), { field: 'name', direction: 'asc' });
  assert.deepEqual(urlSync.decodeSort('name'), { field: 'name', direction: 'asc' }); // Default asc
  assert.equal(urlSync.decodeSort(null), undefined);
  assert.equal(urlSync.decodeSort(''), undefined);
});

/* ------------------------------------------------------------------ */
/* 2. React Query Pagination Key Conventions                          */
/* ------------------------------------------------------------------ */

test('React Query: different filters produce different query keys', () => {
  const k1 = queryKeys.paginationQueryKeys.restPage('orders', { page: 1, size: 20, filters: { status: 'New' } });
  const k2 = queryKeys.paginationQueryKeys.restPage('orders', { page: 1, size: 20, filters: { status: 'Confirmed' } });
  assert.notDeepEqual(k1, k2);
});

test('React Query: different page sizes produce different query keys', () => {
  const k1 = queryKeys.paginationQueryKeys.restPage('orders', { page: 1, size: 10 });
  const k2 = queryKeys.paginationQueryKeys.restPage('orders', { page: 1, size: 20 });
  assert.notDeepEqual(k1, k2);
});

test('React Query: different cursors produce different query keys', () => {
  const k1 = queryKeys.paginationQueryKeys.cursorPage('picking-lists', { size: 20, after: 'cursor_a' });
  const k2 = queryKeys.paginationQueryKeys.cursorPage('picking-lists', { size: 20, after: 'cursor_b' });
  const k3 = queryKeys.paginationQueryKeys.cursorPage('picking-lists', { size: 20 });
  assert.notDeepEqual(k1, k2);
  assert.notDeepEqual(k1, k3);
});

test('React Query: actor scope changes produce isolated query keys to prevent data leakage', () => {
  const adminKey = queryKeys.paginationQueryKeys.cursorPage('picking-lists', { size: 20 }, undefined);
  const keeper1Key = queryKeys.paginationQueryKeys.cursorPage('picking-lists', { size: 20 }, { warehouseIds: ['wh-1'] });
  const keeper2Key = queryKeys.paginationQueryKeys.cursorPage('picking-lists', { size: 20 }, { warehouseIds: ['wh-2'] });

  assert.notDeepEqual(adminKey, keeper1Key);
  assert.notDeepEqual(keeper1Key, keeper2Key);
});

test('React Query: invalidateDomainLists targets only matching queries', async () => {
  const invalidated = [];
  const fakeClient = {
    invalidateQueries: async (opt) => {
      invalidated.push(opt);
    },
  };

  await queryKeys.invalidateDomainLists(fakeClient, 'orders', { warehouseIds: ['wh-1'] });
  assert.equal(invalidated.length, 2);
  assert.deepEqual(invalidated[0].queryKey, ['orders', '{"warehouseIds":["wh-1"]}', 'list']);
  assert.equal(typeof invalidated[1].predicate, 'function');

  // Test predicate matching
  const pred = invalidated[1].predicate;
  assert.equal(pred({ queryKey: ['orders', '{"warehouseIds":["wh-1"]}', 'rest-page', {}] }), true);
  assert.equal(pred({ queryKey: ['orders', '{"warehouseIds":["wh-1"]}', 'cursor-page', {}] }), true);
  // Does not match other domains or other warehouse scopes
  assert.equal(pred({ queryKey: ['retailers', 'global', 'rest-page', {}] }), false);
  assert.equal(pred({ queryKey: ['orders', '{"warehouseIds":["wh-2"]}', 'rest-page', {}] }), false);
});

/* ------------------------------------------------------------------ */
/* 3. Reusable Hooks Behavior                                         */
/* ------------------------------------------------------------------ */

test('useRestPagination: generates expected interfaces and handles resets', () => {
  let currentParams = {};
  const mockSetParams = (updates) => {
    currentParams = { ...currentParams, ...updates };
  };

  const useRestPaginationModule = source('shared/pagination/useRestPagination.ts', {
    react: {
      useCallback: (fn) => fn,
      useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
    },
    '../router/listState': {
      paramName: (ns, k) => (ns ? `${ns}.${k}` : k),
      parsePage: (raw) => (raw ? Number(raw) : 1),
      useQueryParams: () => ({
        params: new Map(Object.entries(currentParams)),
        setParams: mockSetParams,
        hasRouter: true,
      }),
    },
    './types': source('shared/pagination/types.ts'),
    './urlSync': urlSync,
  });

  const res = useRestPaginationModule.useRestPagination({ total: 100, defaultPageSize: 20 });
  assert.equal(res.page, 1);
  assert.equal(res.pageSize, 20);
  assert.equal(res.pagingProps.totalPages, 5);

  // Changing page size resets page to 1
  res.setPageSize(50);
  assert.equal(currentParams.size, 50);
  assert.equal(currentParams.page, null);

  // Changing search resets page to 1
  res.setSearch('test');
  assert.equal(currentParams.q, 'test');
  assert.equal(currentParams.page, null);

  // Changing sort resets page to 1
  res.setSort('createdAt', 'desc');
  assert.equal(currentParams.sort, 'createdAt:desc');
  assert.equal(currentParams.page, null);
});

test('useCursorPagination: manages bidirectional navigation and stack modes', () => {
  let currentParams = {};
  const mockSetParams = (updates) => {
    currentParams = { ...currentParams, ...updates };
  };

  const useCursorPaginationModule = source('shared/pagination/useCursorPagination.ts', {
    react: {
      useCallback: (fn) => fn,
      useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
    },
    '../router/listState': {
      paramName: (ns, k) => (ns ? `${ns}.${k}` : k),
      parsePage: (raw) => (raw ? Number(raw) : 1),
      useQueryParams: () => ({
        params: new Map(Object.entries(currentParams)),
        setParams: mockSetParams,
        hasRouter: true,
      }),
    },
    './types': source('shared/pagination/types.ts'),
    './urlSync': urlSync,
  });

  const pageInfo = {
    hasNextPage: true,
    hasPreviousPage: false,
    startCursor: 'cur_start_1',
    endCursor: 'cur_end_1',
  };

  const res = useCursorPaginationModule.useCursorPagination({
    pageInfo,
    totalCount: 50,
    itemCount: 10,
    defaultPageSize: 10,
  });

  assert.equal(res.currentPage, 1);
  assert.equal(res.totalPages, 5);
  assert.equal(res.isStaleCursor, false);

  // Navigating next sets 'after' and clears 'before'
  res.goNext();
  assert.equal(currentParams.after, 'cur_end_1');
  assert.equal(currentParams.before, null);
  assert.equal(currentParams.page, 2);

  // Setting page size resets all cursor parameters
  res.setPageSize(20);
  assert.equal(currentParams.size, 20);
  assert.equal(currentParams.after, null);
  assert.equal(currentParams.before, null);
  assert.equal(currentParams.page, null);

  // Setting sort resets all cursor parameters
  res.setSort('code', 'asc');
  assert.equal(currentParams.sort, 'code:asc');
  assert.equal(currentParams.after, null);
  assert.equal(currentParams.before, null);
  assert.equal(currentParams.page, null);
});

test('useCursorPagination: valid empty page (no error) is NOT treated as stale cursor', () => {
  let currentParams = { after: 'cursor_123', page: '2' };
  const useCursorPaginationModule = source('shared/pagination/useCursorPagination.ts', {
    react: {
      useCallback: (fn) => fn,
      useState: (initial) => [initial, () => {}],
    },
    '../router/listState': {
      paramName: (ns, k) => (ns ? `${ns}.${k}` : k),
      parsePage: (raw) => (raw ? Number(raw) : 1),
      useQueryParams: () => ({
        params: new Map(Object.entries(currentParams)),
        setParams: (u) => { currentParams = { ...currentParams, ...u }; },
        hasRouter: true,
      }),
    },
    './types': source('shared/pagination/types.ts'),
    './urlSync': urlSync,
  });

  // Empty result with no error = valid empty page (filter too narrow, data deleted) — NOT stale
  const res = useCursorPaginationModule.useCursorPagination({
    pageInfo: { hasNextPage: false, hasPreviousPage: true, startCursor: null, endCursor: null },
    totalCount: 0,
    itemCount: 0,
    loading: false,
    error: undefined,
  });

  assert.equal(res.isStaleCursor, false, 'Empty page without error must NOT be stale cursor');
});

test('useCursorPagination: HC0078 error with active cursor IS stale cursor', () => {
  let currentParams = { after: 'expired_cursor_abc', page: '3' };

  // Minimal ApiError replica matching the shape graphql.ts throws for HC0078
  class ApiError extends Error {
    constructor(status, title, detail, code) {
      super(detail || title);
      this.name = 'ApiError';
      this.status = status;
      this.title = title;
      this.detail = detail;
      this.code = code;
    }
  }

  const useCursorPaginationModule = source('shared/pagination/useCursorPagination.ts', {
    react: {
      useCallback: (fn) => fn,
      useState: (initial) => [initial, () => {}],
    },
    '../router/listState': {
      paramName: (ns, k) => (ns ? `${ns}.${k}` : k),
      parsePage: (raw) => (raw ? Number(raw) : 1),
      useQueryParams: () => ({
        params: new Map(Object.entries(currentParams)),
        setParams: (u) => { currentParams = { ...currentParams, ...u }; },
        hasRouter: true,
      }),
    },
    '../api/errors': { ApiError },
    './types': source('shared/pagination/types.ts'),
    './urlSync': urlSync,
  });

  const hc0078 = new ApiError(400, 'Không tải được dữ liệu', 'Invalid cursor.', 'HC0078');

  const res = useCursorPaginationModule.useCursorPagination({
    pageInfo: { hasNextPage: false, hasPreviousPage: true, startCursor: null, endCursor: null },
    totalCount: 0,
    itemCount: 0,
    loading: false,
    error: hc0078,
  });

  assert.equal(res.isStaleCursor, true, 'HC0078 error with active cursor MUST be stale cursor');

  // firstPage() clears all cursor params
  res.firstPage();
  assert.equal(currentParams.after, null, 'firstPage must clear after');
  assert.equal(currentParams.before, null, 'firstPage must clear before');
  assert.equal(currentParams.page, null, 'firstPage must clear page');
});

test('useCursorPagination: unknown non-HC0078 error is NOT stale cursor', () => {
  let currentParams = { after: 'cursor_xyz', page: '2' };

  class ApiError extends Error {
    constructor(status, title, detail, code) {
      super(detail || title);
      this.name = 'ApiError';
      this.status = status;
      this.title = title;
      this.detail = detail;
      this.code = code;
    }
  }

  const useCursorPaginationModule = source('shared/pagination/useCursorPagination.ts', {
    react: {
      useCallback: (fn) => fn,
      useState: (initial) => [initial, () => {}],
    },
    '../router/listState': {
      paramName: (ns, k) => (ns ? `${ns}.${k}` : k),
      parsePage: (raw) => (raw ? Number(raw) : 1),
      useQueryParams: () => ({
        params: new Map(Object.entries(currentParams)),
        setParams: (u) => { currentParams = { ...currentParams, ...u }; },
        hasRouter: true,
      }),
    },
    '../api/errors': { ApiError },
    './types': source('shared/pagination/types.ts'),
    './urlSync': urlSync,
  });

  // Network error or unknown GraphQL error — NOT stale cursor, should show generic error state
  const networkError = new ApiError(500, 'Lỗi hệ thống', 'Internal error.', 'INTERNAL_SERVER_ERROR');

  const res = useCursorPaginationModule.useCursorPagination({
    pageInfo: { hasNextPage: false, hasPreviousPage: true, startCursor: null, endCursor: null },
    totalCount: 0,
    itemCount: 0,
    loading: false,
    error: networkError,
  });

  assert.equal(res.isStaleCursor, false, 'Non-HC0078 error must NOT be treated as stale cursor');
});

/* ------------------------------------------------------------------ */
/* 4. DataTable Integration & Backwards Compatibility                 */
/* ------------------------------------------------------------------ */

test('DataTable: exports all necessary pagination contracts and components', () => {
  const uiModule = source('shared/ui/index.ts', {
    './Button': { Button: () => null },
    './Card': { Card: () => null },
    './DataTable': { DataTable: () => null },
    './SimpleTable': { SimpleTable: () => null },
    './StatusChip': { StatusChip: () => null, Chip: () => null, toneOf: () => null },
    './PageHeader': { PageHeader: () => null },
    './Tabs': { Tabs: () => null },
    './Modal': { Modal: () => null, Drawer: () => null },
    './FormField': { FormField: () => null, Input: () => null, Select: () => null, TextArea: () => null, Checkbox: () => null },
    './Stat': { Stat: () => null },
    './EmptyState': { EmptyState: () => null },
    './Fields': { Fields: () => null },
    './StepSection': { StepSection: () => null },
    './Toast': { ToastProvider: () => null, useToast: () => null },
    './QueryState': { QueryState: () => null },
    './FormDialog': { FormDialog: () => null },
    './ConfirmDialog': { ConfirmDialog: () => null },
    './Callout': { Callout: () => null },
    './ActionDropdown': { ActionDropdown: () => null },
    './SearchSelect': { SearchSelect: () => null },
    './AddressLocationPicker': { AddressLocationPicker: () => null },
    '../pagination': {
      DEFAULT_PAGE_SIZES: [10, 20, 50],
      PAGINATION_RESETS: ['page', 'after', 'before'],
      useRestPagination: () => ({}),
      useCursorPagination: () => ({}),
      PaginationControls: () => null,
      paginationQueryKeys: queryKeys.paginationQueryKeys,
    },
  });

  assert.ok(uiModule.DataTable, 'DataTable must be exported');
  assert.ok(uiModule.useRestPagination, 'useRestPagination must be exported');
  assert.ok(uiModule.useCursorPagination, 'useCursorPagination must be exported');
  assert.ok(uiModule.PaginationControls, 'PaginationControls must be exported');
  assert.ok(uiModule.paginationQueryKeys, 'paginationQueryKeys must be exported');
});

test('PaginationControls: renders numbered pages and handles disabled states in REST mode', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');

  const controlsModule = source('shared/pagination/PaginationControls.tsx', {
    react: React,
    '../ui/Button': {
      Button: ({ children, disabled, variant, onClick, ...props }) =>
        React.createElement('button', { disabled, className: variant, ...props }, children),
    },
    '../ui/FormField': {
      Select: ({ options, value, onChange, ...props }) =>
        React.createElement(
          'select',
          { value, ...props },
          options.map((o) => React.createElement('option', { key: o.value, value: o.value }, o.label)),
        ),
    },
    './types': source('shared/pagination/types.ts'),
  });

  const html = renderToStaticMarkup(
    React.createElement(controlsModule.PaginationControls, {
      mode: 'rest',
      restPaging: {
        currentPage: 1,
        pageSize: 10,
        total: 35,
        totalPages: 4,
        onPageChange: () => {},
        onPageSizeChange: () => {},
      },
    }),
  );

  // Check Vietnamese text and numbers
  assert.ok(html.includes('Hiển thị 1–10 / 35'), 'Should display record range');
  assert.ok(html.includes('Trước'), 'Should have Trước button');
  assert.ok(html.includes('Sau'), 'Should have Sau button');
  assert.ok(html.includes('disabled=""') || html.includes('disabled'), 'Trước button should be disabled on page 1');
  assert.ok(html.includes('10 / trang'), 'Should render page size options');
});

test('PaginationControls: renders cursor mode — Về trang đầu is NOT rendered here (F-01)', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');

  const controlsModule = source('shared/pagination/PaginationControls.tsx', {
    react: React,
    '../ui/Button': {
      Button: ({ children, disabled, variant, onClick, ...props }) =>
        React.createElement('button', { disabled, className: variant, ...props }, children),
    },
    '../ui/FormField': {
      Select: ({ options, value, onChange, ...props }) =>
        React.createElement(
          'select',
          { value, ...props },
          options.map((o) => React.createElement('option', { key: o.value, value: o.value }, o.label)),
        ),
    },
    './types': source('shared/pagination/types.ts'),
  });

  const normalHtml = renderToStaticMarkup(
    React.createElement(controlsModule.PaginationControls, {
      mode: 'cursor',
      cursorPaging: {
        pageInfo: { hasNextPage: true, hasPreviousPage: true, startCursor: 'c1', endCursor: 'c2' },
        currentPage: 2,
        size: 20,
        totalCount: 60,
        totalPages: 3,
        onNext: () => {},
        onPrev: () => {},
        onFirstPage: () => {},
      },
    }),
  );

  assert.ok(normalHtml.includes('Hiển thị 21–40 / 60'), 'Should render record range');
  assert.ok(normalHtml.includes('Trang 2 / 3'), 'Should display current page and total pages');
  assert.ok(!normalHtml.includes('Về trang đầu'), 'Normal page must not show Về trang đầu button');

  // Stale cursor flag set — PaginationControls must NOT render the recovery button (it lives in DataTable empty state)
  const staleHtml = renderToStaticMarkup(
    React.createElement(controlsModule.PaginationControls, {
      mode: 'cursor',
      cursorPaging: {
        pageInfo: { hasNextPage: false, hasPreviousPage: true, startCursor: null, endCursor: null },
        currentPage: 3,
        size: 20,
        totalCount: 0,
        onNext: () => {},
        onPrev: () => {},
        onFirstPage: () => {},
        isStaleCursor: true,
      },
    }),
  );

  // F-01: recovery button belongs in DataTable empty state only, not in PaginationControls
  assert.ok(!staleHtml.includes('Về trang đầu'), 'PaginationControls must NOT render Về trang đầu — only DataTable empty state does');
});

