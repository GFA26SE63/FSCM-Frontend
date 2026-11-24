const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
  path.resolve(__dirname, '../src/features/warehouses/api.ts'),
  'utf8',
);

test('warehouse GraphQL list uses a field-cost-safe cursor page size', () => {
  assert.match(source, /const WAREHOUSES_GRAPHQL_PAGE_SIZE = 50;/);
  assert.match(
    source,
    /buildWarehousesListQuery\(WAREHOUSES_GRAPHQL_PAGE_SIZE, !!after\)/,
  );
  assert.doesNotMatch(source, /buildWarehousesListQuery\(500,/);
});
