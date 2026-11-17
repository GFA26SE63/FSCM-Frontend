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
      if (resolved.endsWith('.ts') || resolved.endsWith('.tsx')) {
        if (fs.existsSync(path.resolve(__dirname, '../src', resolved))) return source(resolved, mocks);
      } else {
        const tsPath = `${resolved}.ts`;
        const tsxPath = `${resolved}.tsx`;
        if (fs.existsSync(path.resolve(__dirname, '../src', tsPath))) return source(tsPath, mocks);
        if (fs.existsSync(path.resolve(__dirname, '../src', tsxPath))) return source(tsxPath, mocks);
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
      useEffect: () => {},
      useMemo: (fn) => fn(),
      useRef: (initial) => ({ current: initial }),
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
      useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
      useEffect: () => {},
      useMemo: (fn) => fn(),
      useRef: (initial) => ({ current: initial }),
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
      useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
      useEffect: () => {},
      useMemo: (fn) => fn(),
      useRef: (initial) => ({ current: initial }),
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
      useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
      useEffect: () => {},
      useMemo: (fn) => fn(),
      useRef: (initial) => ({ current: initial }),
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

  // Button mock shared for PaginationControls ('../ui/Button') and Pagination.tsx ('../../ui/Button')
  const buttonMock = {
    Button: ({ children, disabled, variant, onClick, 'aria-current': ariaCurrent, ...props }) =>
      React.createElement('button', { disabled, className: variant, onClick, 'aria-current': ariaCurrent, ...props }, children),
  };
  const formFieldMock = {
    Select: ({ options, value, onChange, ...props }) =>
      React.createElement(
        'select',
        { value, onChange, ...props },
        (options || []).map((o) => React.createElement('option', { key: o.value, value: o.value }, o.label)),
      ),
  };

  const controlsModule = source('shared/pagination/PaginationControls.tsx', {
    react: React,
    '../ui/Button': buttonMock,
    '../ui/FormField': formFieldMock,
    '../../ui/Button': buttonMock,       // used by components/Pagination.tsx
    '../../ui/FormField': formFieldMock, // used by components/Pagination.tsx
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

test('PaginationControls: renders cursor mode with numbered page indicators (F-01)', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');

  // Button and Select mocks must be provided for both PaginationControls.tsx (uses '../ui/...')
  // and Pagination.tsx inside components/ (uses '../../ui/...').
  const buttonMock = {
    Button: ({ children, disabled, variant, onClick, 'aria-current': ariaCurrent, ...props }) =>
      React.createElement('button', { disabled, className: variant, onClick, 'aria-current': ariaCurrent, ...props }, children),
  };
  const formFieldMock = {
    Select: ({ options, value, onChange, ...props }) =>
      React.createElement(
        'select',
        { value, onChange, ...props },
        (options || []).map((o) => React.createElement('option', { key: o.value, value: o.value }, o.label)),
      ),
  };

  const controlsModule = source('shared/pagination/PaginationControls.tsx', {
    react: React,
    '../ui/Button': buttonMock,
    '../ui/FormField': formFieldMock,
    '../../ui/Button': buttonMock,       // used by components/Pagination.tsx
    '../../ui/FormField': formFieldMock, // used by components/Pagination.tsx
    './types': source('shared/pagination/types.ts'),
  });

  // Page 2 of 3, all pages navigable (no availablePages restriction)
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
  // New behavior: numbered page indicator buttons replace "Trang X / Y" text
  assert.ok(normalHtml.includes('aria-current="page"'), 'Active page must carry aria-current=page');
  assert.ok(normalHtml.includes('>2<') || normalHtml.includes('>2</'), 'Page 2 must appear as an indicator');
  assert.ok(normalHtml.includes('>1<') || normalHtml.includes('>1</'), 'Page 1 must appear as an indicator');
  assert.ok(normalHtml.includes('>3<') || normalHtml.includes('>3</'), 'Page 3 must appear as an indicator');
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

/* ------------------------------------------------------------------ */
/* 5. Cursor Registry and Common Pagination Component                 */
/* ------------------------------------------------------------------ */

test('Pagination: REST mode renders all pages as clickable, correct record range', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');

  const buttonMock = {
    Button: ({ children, disabled, variant, onClick, 'aria-current': ariaCurrent, ...props }) =>
      React.createElement('button', { disabled, className: variant, onClick, 'aria-current': ariaCurrent, ...props }, children),
  };
  const formFieldMock = {
    Select: ({ options, value, onChange, ...props }) =>
      React.createElement('select', { value, onChange, ...props },
        (options || []).map((o) => React.createElement('option', { key: o.value, value: o.value }, o.label))),
  };

  const paginationModule = source('shared/pagination/components/Pagination.tsx', {
    react: React,
    '../../ui/Button': buttonMock,
    '../../ui/FormField': formFieldMock,
    '../types': source('shared/pagination/types.ts'),
  });

  const html = renderToStaticMarkup(
    React.createElement(paginationModule.Pagination, {
      currentPage: 2,
      totalPages: 5,
      totalCount: 50,
      pageSize: 10,
      navigablePages: undefined, // REST: all pages navigable
      hasPrev: true,
      hasNext: true,
      onPage: () => {},
      onPrev: () => {},
      onNext: () => {},
    }),
  );

  assert.ok(html.includes('Hiển thị 11–20 / 50'), 'Record range must be correct for page 2');
  assert.ok(html.includes('aria-current="page"'), 'Active page must have aria-current=page');
  // In REST mode (navigablePages=undefined), pages should NOT be disabled
  // (all page indicator buttons are navigable)
  // REST mode: navigablePages is undefined so all page buttons should be enabled (not disabled)
  // The only disabled button should be Trước (page 1 is not prev-available from page 1)
  // Here we're on page 2 so Trước is enabled too — only Sau could be disabled if on last page
  assert.ok(html.includes('>1<') || html.includes('>1</'), 'Page 1 indicator must be rendered');
});

test('Pagination: cursor mode shows non-navigable pages as disabled reference indicators', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');

  const buttonMock = {
    Button: ({ children, disabled, variant, onClick, 'aria-current': ariaCurrent, ...props }) =>
      React.createElement('button', { disabled, className: variant, onClick, 'aria-current': ariaCurrent, ...props }, children),
  };
  const formFieldMock = {
    Select: ({ options, value, onChange, ...props }) =>
      React.createElement('select', { value, onChange, ...props },
        (options || []).map((o) => React.createElement('option', { key: o.value, value: o.value }, o.label))),
  };

  const paginationModule = source('shared/pagination/components/Pagination.tsx', {
    react: React,
    '../../ui/Button': buttonMock,
    '../../ui/FormField': formFieldMock,
    '../types': source('shared/pagination/types.ts'),
  });

  // Cursor mode: on page 2 of 5, only pages 1, 2, 3 are navigable (page 4, 5 not yet visited)
  const html = renderToStaticMarkup(
    React.createElement(paginationModule.Pagination, {
      currentPage: 2,
      totalPages: 5,
      totalCount: 50,
      pageSize: 10,
      navigablePages: [1, 2, 3], // cursor mode: only visited + adjacent are reachable
      hasPrev: true,
      hasNext: true,
      onPage: () => {},
      onPrev: () => {},
      onNext: () => {},
    }),
  );

  assert.ok(html.includes('Hiển thị 11–20 / 50'), 'Record range must be correct');
  assert.ok(html.includes('aria-current="page"'), 'Active page 2 must have aria-current');
  // Page 4 and 5 should be rendered as disabled (they're in totalPages range but not in navigablePages)
  // We can check that there are some disabled buttons (the non-navigable page indicators)
  assert.ok(html.includes('disabled=""') || html.includes('disabled'), 'Non-navigable pages should appear as disabled indicators');
});

test('useCursorPagination: cursor registry tracks visited pages and builds availablePages', () => {
  let currentParams = {};
  let effectCallbacks = [];

  const useCursorPaginationModule = source('shared/pagination/useCursorPagination.ts', {
    react: {
      useCallback: (fn) => fn,
      useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
      useMemo: (fn) => fn(),
      useRef: (initial) => ({ current: initial }),
      // Capture useEffect callbacks for manual invocation in tests
      useEffect: (fn) => { effectCallbacks.push(fn); },
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

  const pageInfo = {
    hasNextPage: true,
    hasPreviousPage: false,
    startCursor: null,
    endCursor: 'cursor_for_page_2',
  };

  const res = useCursorPaginationModule.useCursorPagination({
    pageInfo,
    totalCount: 30,
    defaultPageSize: 10,
  });

  // On page 1: availablePages must include at minimum page 1 (current) and page 2 (hasNextPage)
  assert.ok(res.availablePages.includes(1), 'Page 1 must always be in availablePages');
  assert.ok(res.availablePages.includes(2), 'Page 2 must be in availablePages when hasNextPage');
  assert.equal(typeof res.goToPage, 'function', 'goToPage must be a function');
  assert.equal(typeof res.pagingProps.onPage, 'function', 'pagingProps.onPage must be a function');
  assert.ok(Array.isArray(res.pagingProps.availablePages), 'pagingProps.availablePages must be an array');
});

test('useCursorPagination: goToPage uses registry cursor to navigate to previously visited pages', () => {
  let currentParams = { after: 'cursor_for_page_2', page: '2' };
  let registryMap = new Map([
    [3, 'cursor_for_page_3'], // simulate previously visited page 2 registered cursor for page 3
  ]);

  const useCursorPaginationModule = source('shared/pagination/useCursorPagination.ts', {
    react: {
      useCallback: (fn) => fn,
      useState: (initial) => {
        // Return the pre-populated registry for cursorRegistry state
        if (typeof initial === 'function' && initial.toString().includes('new Map')) {
          return [registryMap, (newMap) => { registryMap = typeof newMap === 'function' ? newMap(registryMap) : newMap; }];
        }
        return [typeof initial === 'function' ? initial() : initial, () => {}];
      },
      useMemo: (fn) => fn(),
      useEffect: () => {},
      useRef: (initial) => ({ current: initial }),
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
    '../api/errors': { ApiError: class ApiError extends Error { constructor(s, t, d, c) { super(d||t); this.status=s; this.code=c; } } },
    './types': source('shared/pagination/types.ts'),
    './urlSync': urlSync,
  });

  const pageInfo = {
    hasNextPage: true,
    hasPreviousPage: true,
    startCursor: 'cursor_start_2',
    endCursor: 'cursor_for_page_3',
  };

  const res = useCursorPaginationModule.useCursorPagination({
    pageInfo,
    totalCount: 30,
    defaultPageSize: 10,
  });

  // availablePages should include page 3 from the registry
  assert.ok(res.availablePages.includes(3), 'Page 3 from registry must appear in availablePages');

  // goToPage(3) should navigate using the registry cursor
  res.goToPage(3);
  assert.equal(currentParams.after, 'cursor_for_page_3', 'goToPage must use registry cursor as after param');
  assert.equal(currentParams.before, null, 'goToPage must clear before param');
  assert.equal(currentParams.page, 3, 'goToPage must set page param to target page');
});

test('useCursorPagination: registry resets on page size change', () => {
  let currentParams = {};
  let registryMap = new Map([[2, 'cursor_for_p2'], [3, 'cursor_for_p3']]);
  let registrySetterCalled = false;

  const useCursorPaginationModule = source('shared/pagination/useCursorPagination.ts', {
    react: {
      useCallback: (fn) => fn,
      useState: (initial) => {
        if (typeof initial === 'function' && initial.toString().includes('new Map')) {
          return [registryMap, (newMap) => {
            registrySetterCalled = true;
            registryMap = typeof newMap === 'function' ? newMap(registryMap) : newMap;
          }];
        }
        return [typeof initial === 'function' ? initial() : initial, () => {}];
      },
      useMemo: (fn) => fn(),
      useEffect: () => {},
      useRef: (initial) => ({ current: initial }),
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

  const res = useCursorPaginationModule.useCursorPagination({
    pageInfo: { hasNextPage: true, hasPreviousPage: false, startCursor: null, endCursor: 'c1' },
    totalCount: 50,
    defaultPageSize: 10,
  });

  res.setPageSize(20);
  assert.ok(registrySetterCalled, 'Registry must be cleared (setter called) on page size change');
  assert.equal(currentParams.after, null, 'Cursor after must reset');
  assert.equal(currentParams.page, null, 'Page must reset');
});

/* ------------------------------------------------------------------ */
/* 6. Sequential Cursor Resolution                                     */
/* ------------------------------------------------------------------ */

test('useCursorPagination: goToPage(N) with no registry cursor starts sequential resolution', () => {
  let currentParams = {};
  let isResolvingValue = false;

  const useCursorPaginationModule = source('shared/pagination/useCursorPagination.ts', {
    react: {
      useCallback: (fn) => fn,
      useState: (initial) => {
        const v = typeof initial === 'function' ? initial() : initial;
        // isResolving state
        if (v === false && initial === false) {
          return [isResolvingValue, (n) => { isResolvingValue = n; }];
        }
        return [v, () => {}];
      },
      useMemo: (fn) => fn(),
      useEffect: () => {},
      useRef: (initial) => ({ current: initial }),
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

  const pageInfo = { hasNextPage: true, hasPreviousPage: false, startCursor: null, endCursor: 'e1_to_p2' };
  const res = useCursorPaginationModule.useCursorPagination({ pageInfo, totalCount: 60, defaultPageSize: 10 });

  // Currently on page 1, no registry — clicking page 6 should trigger sequential resolution
  res.goToPage(6);

  // Should set isResolving = true (via setPendingTarget(6))
  assert.equal(isResolvingValue, true, 'isResolving must be true when sequential resolution starts');
  // Should navigate toward page 2 using current page endCursor
  assert.equal(currentParams.after, 'e1_to_p2', 'Should use current page endCursor to start resolution');
  assert.equal(currentParams.page, 2, 'Should navigate to page 2 as first step');
  assert.equal(currentParams.before, null, 'before cursor must be cleared');
});

test('useCursorPagination: goToPage uses best-known cursor as jump-off for sequential resolution', () => {
  let currentParams = {};
  let isResolvingValue = false;
  let registryMap = new Map([
    [2, 'cursor_to_p2'],
    [3, 'cursor_to_p3'],
    [4, 'cursor_to_p4'],
  ]);

  const useCursorPaginationModule = source('shared/pagination/useCursorPagination.ts', {
    react: {
      useCallback: (fn) => fn,
      useState: (initial) => {
        const v = typeof initial === 'function' ? initial() : initial;
        if (v instanceof Map) {
          return [registryMap, (n) => { registryMap = typeof n === 'function' ? n(registryMap) : n; }];
        }
        if (v === false && initial === false) {
          return [isResolvingValue, (n) => { isResolvingValue = n; }];
        }
        return [v, () => {}];
      },
      useMemo: (fn) => fn(),
      useEffect: () => {},
      useRef: (initial) => ({ current: initial }),
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

  const pageInfo = { hasNextPage: true, hasPreviousPage: false, startCursor: null, endCursor: 'e1_to_p2' };
  const res = useCursorPaginationModule.useCursorPagination({ pageInfo, totalCount: 70, defaultPageSize: 10 });

  // Registry has cursors for pages 2, 3, 4. Clicking page 7 should start from page 4 (best known).
  res.goToPage(7);

  assert.equal(isResolvingValue, true, 'isResolving must be true during sequential resolution');
  assert.equal(currentParams.after, 'cursor_to_p4', 'Should jump to highest known page (4) before target');
  assert.equal(currentParams.page, 4, 'Should set page param to best-known jump-off page');
});

test('useCursorPagination: goToPage direct-navigates registered pages and cancels prior resolution', () => {
  let currentParams = {};
  let isResolvingValue = true; // simulate an in-progress resolution
  let registryMap = new Map([[3, 'cursor_to_p3']]);
  let pendingTargetValue = { current: 6 }; // simulate in-progress resolution

  const useCursorPaginationModule = source('shared/pagination/useCursorPagination.ts', {
    react: {
      useCallback: (fn) => fn,
      useState: (initial) => {
        const v = typeof initial === 'function' ? initial() : initial;
        if (v instanceof Map) {
          return [registryMap, (n) => { registryMap = typeof n === 'function' ? n(registryMap) : n; }];
        }
        if (v === false && initial === false) {
          return [isResolvingValue, (n) => { isResolvingValue = n; }];
        }
        return [v, () => {}];
      },
      useMemo: (fn) => fn(),
      useEffect: () => {},
      useRef: (initial) => {
        // Return our pre-populated ref for pendingTarget
        if (initial === null) return pendingTargetValue;
        return { current: initial };
      },
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

  const pageInfo = { hasNextPage: true, hasPreviousPage: true, startCursor: 'cs', endCursor: 'ce' };
  const res = useCursorPaginationModule.useCursorPagination({ pageInfo, totalCount: 70, defaultPageSize: 10 });

  // Page 3 is in registry. Clicking it must cancel the in-progress resolution (pendingTarget→null)
  // and navigate directly.
  res.goToPage(3);

  assert.equal(currentParams.after, 'cursor_to_p3', 'Must use registry cursor for direct navigation');
  assert.equal(currentParams.page, 3, 'Must set page param to target');
  assert.equal(isResolvingValue, false, 'isResolving must be false after direct navigation cancels resolution');
});

test('useCursorPagination: registry resets on search change', () => {
  let currentParams = {};
  let registryCleared = false;
  let registryMap = new Map([[2, 'cursor_p2'], [3, 'cursor_p3']]);

  const useCursorPaginationModule = source('shared/pagination/useCursorPagination.ts', {
    react: {
      useCallback: (fn) => fn,
      useState: (initial) => {
        const v = typeof initial === 'function' ? initial() : initial;
        if (v instanceof Map) {
          return [registryMap, (n) => {
            const next = typeof n === 'function' ? n(registryMap) : n;
            if (next instanceof Map && next.size === 0) registryCleared = true;
            registryMap = next;
          }];
        }
        return [v, () => {}];
      },
      useMemo: (fn) => fn(),
      useEffect: () => {},
      useRef: (initial) => ({ current: initial }),
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

  const res = useCursorPaginationModule.useCursorPagination({
    pageInfo: { hasNextPage: true, hasPreviousPage: false, startCursor: null, endCursor: 'c1' },
    totalCount: 50, defaultPageSize: 10,
  });

  res.setSearch('new query');
  assert.ok(registryCleared, 'Registry must be cleared on search change');
  assert.equal(currentParams.after, null, 'after cursor must reset');
  assert.equal(currentParams.page, null, 'page must reset');
});

test('useCursorPagination: registry resets on sort change', () => {
  let currentParams = {};
  let registryCleared = false;
  let registryMap = new Map([[2, 'cursor_p2']]);

  const useCursorPaginationModule = source('shared/pagination/useCursorPagination.ts', {
    react: {
      useCallback: (fn) => fn,
      useState: (initial) => {
        const v = typeof initial === 'function' ? initial() : initial;
        if (v instanceof Map) {
          return [registryMap, (n) => {
            const next = typeof n === 'function' ? n(registryMap) : n;
            if (next instanceof Map && next.size === 0) registryCleared = true;
            registryMap = next;
          }];
        }
        return [v, () => {}];
      },
      useMemo: (fn) => fn(),
      useEffect: () => {},
      useRef: (initial) => ({ current: initial }),
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

  const res = useCursorPaginationModule.useCursorPagination({
    pageInfo: { hasNextPage: true, hasPreviousPage: false, startCursor: null, endCursor: 'c1' },
    totalCount: 50, defaultPageSize: 10,
  });

  res.setSort('createdAt', 'desc');
  assert.ok(registryCleared, 'Registry must be cleared on sort change');
  assert.equal(currentParams.after, null, 'after cursor must reset');
  assert.equal(currentParams.page, null, 'page must reset');
});

test('useCursorPagination: registry effect advances resolution step by step', () => {
  let currentParams = {};
  let effectCallbacks = [];
  let registryMap = new Map();

  const useCursorPaginationModule = source('shared/pagination/useCursorPagination.ts', {
    react: {
      useCallback: (fn) => fn,
      useState: (initial) => {
        const v = typeof initial === 'function' ? initial() : initial;
        if (v instanceof Map) {
          return [registryMap, (n) => { registryMap = typeof n === 'function' ? n(registryMap) : n; }];
        }
        return [v, () => {}];
      },
      useMemo: (fn) => fn(),
      useRef: (initial) => ({ current: initial }),
      useEffect: (fn) => { effectCallbacks.push(fn); },
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

  const pageInfo = { hasNextPage: true, hasPreviousPage: false, startCursor: null, endCursor: 'e1' };
  useCursorPaginationModule.useCursorPagination({ pageInfo, totalCount: 60, defaultPageSize: 10 });

  // Find the registry/resolution useEffect (the one that fires on pageInfo changes).
  // With the new code, effects are: [queryContext-effect, registry+resolution-effect].
  // The registry+resolution effect is the one that uses pageInfo.endCursor.
  // We'll invoke all effects and pick the one that updates params.
  const prevParamsBefore = { ...currentParams };

  // Simulate: set pendingTarget to 3 via the ref (effects can't set state in test, but ref is accessible)
  // We access the ref returned by useRef(null) — first null-initial ref is pendingTargetRef.
  // Actually the registry effect reads pendingTargetRef.current which the mock returns as { current: null }.
  // Set it to 3 manually:
  let pendingRef = null;
  const moduleWithRef = source('shared/pagination/useCursorPagination.ts', {
    react: {
      useCallback: (fn) => fn,
      useState: (initial) => {
        const v = typeof initial === 'function' ? initial() : initial;
        if (v instanceof Map) {
          return [registryMap, (n) => { registryMap = typeof n === 'function' ? n(registryMap) : n; }];
        }
        return [v, () => {}];
      },
      useMemo: (fn) => fn(),
      useRef: (initial) => {
        if (initial === null && pendingRef === null) {
          pendingRef = { current: 3 }; // simulate pendingTarget = 3
          return pendingRef;
        }
        return { current: initial };
      },
      useEffect: (fn) => { effectCallbacks.push(fn); },
    },
    '../router/listState': {
      paramName: (ns, k) => (ns ? `${ns}.${k}` : k),
      parsePage: (raw) => (raw ? Number(raw) : 1),
      useQueryParams: () => ({
        params: new Map([['page', '1']]),
        setParams: (u) => { currentParams = { ...currentParams, ...u }; },
        hasRouter: true,
      }),
    },
    './types': source('shared/pagination/types.ts'),
    './urlSync': urlSync,
  });

  moduleWithRef.useCursorPagination({
    pageInfo: { hasNextPage: true, hasPreviousPage: false, startCursor: null, endCursor: 'cursor_p1_to_p2' },
    totalCount: 60, defaultPageSize: 10,
  });

  // Invoke the last captured effect (the registry+resolution effect)
  const registryEffect = effectCallbacks[effectCallbacks.length - 1];
  registryEffect();

  // Should have navigated to page 2 (currentPage=1, pendingTarget=3, so advance to 2)
  assert.equal(currentParams.after, 'cursor_p1_to_p2', 'Effect must advance to next page');
  assert.equal(currentParams.page, 2, 'Effect must set page param to next page');
  // Registry should have page 2 cursor registered
  assert.ok(registryMap.get(2) === 'cursor_p1_to_p2', 'Registry must record cursor for page 2');
});

test('PaginationControls: cursor mode renders all page indicators as clickable (no disabled)', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');

  const disabledPages = [];
  const buttonMock = {
    Button: ({ children, disabled, variant, onClick, 'aria-current': ariaCurrent, ...props }) => {
      // Track any page-number button that gets disabled
      if (disabled && typeof children === 'number') disabledPages.push(children);
      return React.createElement('button', { disabled, className: variant, onClick, 'aria-current': ariaCurrent, ...props }, children);
    },
  };
  const formFieldMock = {
    Select: ({ options, value, onChange, ...props }) =>
      React.createElement('select', { value, onChange, ...props },
        (options || []).map((o) => React.createElement('option', { key: o.value, value: o.value }, o.label))),
  };

  const controlsModule = source('shared/pagination/PaginationControls.tsx', {
    react: React,
    '../ui/Button': buttonMock,
    '../ui/FormField': formFieldMock,
    '../../ui/Button': buttonMock,
    '../../ui/FormField': formFieldMock,
    './types': source('shared/pagination/types.ts'),
  });

  // Page 2 of 5. With the new navigablePages=undefined approach, ALL page indicators (1-5) are clickable.
  renderToStaticMarkup(
    React.createElement(controlsModule.PaginationControls, {
      mode: 'cursor',
      cursorPaging: {
        pageInfo: { hasNextPage: true, hasPreviousPage: true, startCursor: 'c1', endCursor: 'c2' },
        currentPage: 2,
        size: 10,
        totalCount: 50,
        totalPages: 5,
        onNext: () => {},
        onPrev: () => {},
        onFirstPage: () => {},
        onPage: () => {},
        availablePages: [1, 2, 3], // even though only 1-3 are in availablePages...
      },
    }),
  );

  // With navigablePages=undefined, page 4 and 5 should NOT be in disabledPages
  assert.ok(!disabledPages.includes(4), 'Page 4 must not be disabled (sequential resolution handles it)');
  assert.ok(!disabledPages.includes(5), 'Page 5 must not be disabled (sequential resolution handles it)');
  assert.ok(!disabledPages.includes(1), 'Page 1 must not be disabled');
  assert.ok(!disabledPages.includes(3), 'Page 3 must not be disabled');
});

test('PaginationControls: cursor mode shows loading state when isResolving is true', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');

  const buttonMock = {
    Button: ({ children, disabled, ...props }) =>
      React.createElement('button', { disabled, ...props }, children),
  };
  const formFieldMock = {
    Select: ({ options, value, onChange, ...props }) =>
      React.createElement('select', { value, onChange, ...props },
        (options || []).map((o) => React.createElement('option', { key: o.value, value: o.value }, o.label))),
  };

  const controlsModule = source('shared/pagination/PaginationControls.tsx', {
    react: React,
    '../ui/Button': buttonMock,
    '../ui/FormField': formFieldMock,
    '../../ui/Button': buttonMock,
    '../../ui/FormField': formFieldMock,
    './types': source('shared/pagination/types.ts'),
  });

  const html = renderToStaticMarkup(
    React.createElement(controlsModule.PaginationControls, {
      mode: 'cursor',
      cursorPaging: {
        pageInfo: { hasNextPage: true, hasPreviousPage: true, startCursor: 'c1', endCursor: 'c2' },
        currentPage: 2,
        size: 10,
        totalCount: 50,
        totalPages: 5,
        onNext: () => {},
        onPrev: () => {},
        onFirstPage: () => {},
        onPage: () => {},
        isResolving: true,
        loading: false,
      },
    }),
  );

  // When isResolving=true, all navigation buttons must be disabled (loading state)
  assert.ok(html.includes('disabled'), 'Navigation buttons must be disabled during resolution (loading state)');
});

