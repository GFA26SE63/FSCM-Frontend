const { test } = require('node:test');
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
    if (name.startsWith('.') || name.startsWith('@/')) {
      throw new Error('Missing boundary mock: ' + name + ' in ' + file);
    }
    return require(name);
  };
  new Function('require', 'module', 'exports', code)(imports, module, module.exports);
  return module.exports;
}

const retailerSort = source('features/retailers/retailerSort.ts');

test('Retailer Sorting: Default "newest" sorts by createdAt DESC', () => {
  const items = [
    { id: '1', code: 'RT-001', createdAt: '2026-01-10T08:00:00Z' },
    { id: '2', code: 'RT-002', createdAt: '2026-03-15T12:00:00Z' },
    { id: '3', code: 'RT-003', createdAt: '2026-02-20T10:30:00Z' },
  ];

  const sortedDefault = retailerSort.sortRetailers(items);
  assert.deepEqual(sortedDefault.map((x) => x.code), ['RT-002', 'RT-003', 'RT-001']);

  const sortedExplicitNewest = retailerSort.sortRetailers(items, 'newest');
  assert.deepEqual(sortedExplicitNewest.map((x) => x.code), ['RT-002', 'RT-003', 'RT-001']);
});

test('Retailer Sorting: "oldest" sorts by createdAt ASC', () => {
  const items = [
    { id: '1', code: 'RT-001', createdAt: '2026-01-10T08:00:00Z' },
    { id: '2', code: 'RT-002', createdAt: '2026-03-15T12:00:00Z' },
    { id: '3', code: 'RT-003', createdAt: '2026-02-20T10:30:00Z' },
  ];

  const sortedOldest = retailerSort.sortRetailers(items, 'oldest');
  assert.deepEqual(sortedOldest.map((x) => x.code), ['RT-001', 'RT-003', 'RT-002']);
});

test('Retailer Sorting: strictly uses createdAt and NEVER updatedAt', () => {
  // RT-OLD was created earlier (Jan 2026) but updated recently (April 2026)
  // RT-NEW was created later (March 2026) but updated earlier (March 2026)
  const items = [
    {
      id: 'old-item',
      code: 'RT-OLD',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-04-01T00:00:00Z',
    },
    {
      id: 'new-item',
      code: 'RT-NEW',
      createdAt: '2026-03-01T00:00:00Z',
      updatedAt: '2026-03-02T00:00:00Z',
    },
  ];

  // For 'newest', RT-NEW must come first based on createdAt (March > Jan), ignoring updatedAt
  const sortedNewest = retailerSort.sortRetailers(items, 'newest');
  assert.equal(sortedNewest[0].code, 'RT-NEW');
  assert.equal(sortedNewest[1].code, 'RT-OLD');

  // For 'oldest', RT-OLD must come first based on createdAt (Jan < March), ignoring updatedAt
  const sortedOldest = retailerSort.sortRetailers(items, 'oldest');
  assert.equal(sortedOldest[0].code, 'RT-OLD');
  assert.equal(sortedOldest[1].code, 'RT-NEW');
});

test('Retailer Sorting: stable tie-breaker when createdAt is identical', () => {
  const items = [
    { id: 'a', code: 'RT-100', createdAt: '2026-02-01T00:00:00Z' },
    { id: 'b', code: 'RT-200', createdAt: '2026-02-01T00:00:00Z' },
    { id: 'c', code: 'RT-050', createdAt: '2026-02-01T00:00:00Z' },
  ];

  const sortedNewest = retailerSort.sortRetailers(items, 'newest');
  assert.deepEqual(sortedNewest.map((x) => x.code), ['RT-200', 'RT-100', 'RT-050']);

  const sortedOldest = retailerSort.sortRetailers(items, 'oldest');
  assert.deepEqual(sortedOldest.map((x) => x.code), ['RT-050', 'RT-100', 'RT-200']);
});

test('Retailer Sorting: handles missing or invalid createdAt safely', () => {
  const items = [
    { id: '1', code: 'RT-VALID', createdAt: '2026-02-01T00:00:00Z' },
    { id: '2', code: 'RT-NO-DATE' },
    { id: '3', code: 'RT-INVALID-DATE', createdAt: 'not-a-date' },
  ];

  assert.doesNotThrow(() => {
    const sorted = retailerSort.sortRetailers(items, 'newest');
    assert.equal(sorted[0].code, 'RT-VALID');
  });
});

test('RetailersPage preserves incoming server pagination and review navigation', () => {
  // Phase C.1: migrated from REST offset pagination to GraphQL cursor pagination
  // (entities.retailers). Server-side pagination, search, filter, and review
  // navigation are all preserved — only the transport and hook changed.
  const pageCode = fs.readFileSync(path.resolve(__dirname, '../src/features/retailers/pages/RetailersPage.tsx'), 'utf8');
  assert.ok(pageCode.includes('useCursorPagination('));
  assert.ok(pageCode.includes('useRetailersPage({'));
  assert.ok(pageCode.includes('pageSize,') && pageCode.includes('search: search || undefined'));
  assert.ok(pageCode.includes('rows={rows}') && pageCode.includes('cursor={pagingProps}'));
  assert.ok(pageCode.includes('STATUS_FILTER_OPTIONS'));
  assert.ok(pageCode.includes("can(user, 'retailers.review')"));
  // GraphQL rows always carry a non-null id (entity primary key) — no code fallback needed.
  assert.ok(pageCode.includes('onRowClick={(row) => navigate(`/retailers/${row.id}`)}'));
});
