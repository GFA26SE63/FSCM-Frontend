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

test('Source Code Integrity: RetailersPage integrates sort control and preserves table functionality', () => {
  const pageCode = fs.readFileSync(
    path.resolve(__dirname, '../src/features/retailers/pages/RetailersPage.tsx'),
    'utf8',
  );

  // Sort control in filterExtra
  assert.ok(pageCode.includes('filterExtra='), 'Must define filterExtra for DataTable');
  assert.ok(pageCode.includes('Sắp xếp theo'), 'Must have label "Sắp xếp theo"');
  assert.ok(pageCode.includes('SORT_SELECT_OPTIONS'), 'Must use SORT_SELECT_OPTIONS');
  assert.ok(pageCode.includes('useEnumParam<RetailerSort>'), 'Must bind sort to URL via useEnumParam');
  assert.ok(pageCode.includes("'sort'"), "Must use 'sort' query param");
  assert.ok(pageCode.includes("resets: ['page']"), 'Changing sort must reset to page 1');

  // Sorting full dataset before table pagination
  assert.ok(pageCode.includes('sortRetailers(rawRows, sort)'), 'Must sort rawRows before passing to DataTable');
  assert.ok(pageCode.includes('rows={rows}'), 'DataTable must receive sorted rows');

  // Existing table and filter integrations must be preserved
  assert.ok(pageCode.includes("label: 'Trạng thái'"), 'Status filter must be preserved');
  assert.ok(pageCode.includes("label: 'Nhóm Sales'"), 'Sales group filter must be preserved');
  assert.ok(pageCode.includes('searchPlaceholder="Mã, tên điểm bán, người liên hệ, SĐT..."'), 'Search placeholder preserved');
  assert.ok(pageCode.includes('rowActionHeader="Thao tác"'), 'Row action header preserved');
  assert.ok(pageCode.includes('onRowClick={(row) => navigate(`/retailers/${row.id || row.code}`)}'), 'Row navigation preserved');
});
