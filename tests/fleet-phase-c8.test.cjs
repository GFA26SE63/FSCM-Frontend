'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const read = (p) => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');
const gql = read('src/features/fleet/fleetGraphql.ts');
const page = read('src/features/fleet/pages/FleetPage.tsx');
const api = read('src/features/fleet/api.ts');

test('vehicles and drivers use cursor paging, literal first/last, newest-first + id tiebreaker', () => {
  assert.ok(gql.includes("entity: 'vehicles'") && gql.includes("entity: 'drivers'"));
  assert.ok(gql.includes('first: ${q.size}') && gql.includes('last: ${q.size}'));
  assert.ok(gql.includes('order: [{ createdAt: DESC }, { id: DESC }]') && gql.includes('{ id: DESC }]`'));
});
test('sort keys equal DataTable column keys', () => {
  for (const k of ['plateNumber', 'vehicleType', 'capacity', 'code', 'fullName', 'phone', 'licenseNumber']) {
    assert.ok(page.includes(`key: '${k}'`), k);
    assert.ok(gql.includes(`${k}: '${k}'`), k);
  }
  assert.ok(page.includes('serverSort='));
});
test('search ORs the entity fields with resolved warehouse ids; filters use eq', () => {
  assert.ok(gql.includes('{ warehouseId: { in: $searchWarehouseIds } }') && gql.includes('{ warehouseId: { eq: $warehouseId } }'));
  assert.ok(gql.includes('{ isActive: { eq: true } }') && gql.includes('{ isActive: { eq: false } }'));
});
test('tab switch resets cursor, sort, search and filters; only the visible tab is fetched', () => {
  assert.ok(page.includes('PAGINATION_PARAM_NAMES.SORT, PAGINATION_PARAM_NAMES.SEARCH'));
  assert.ok((page.match(/useFleetPage</g) || []).length === 1);
});
test('detail and all writes stay REST', () => {
  assert.ok(api.includes("'/deliveries/vehicles'") && api.includes('createVehicle') && api.includes('setDriverActive'));
});
