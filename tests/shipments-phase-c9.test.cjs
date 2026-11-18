'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const read = (p) => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');
const gql = read('src/features/shipments/shipmentsGraphql.ts');
const api = read('src/features/shipments/api.ts');

test('order-scoped shipments query: orderId eq, newest-first + id tiebreaker, cursor loop', () => {
  assert.ok(gql.includes('where: { salesOrderId: { eq: $orderId } }'));
  assert.ok(gql.includes('order: [{ createdAt: DESC }, { id: DESC }]'));
  assert.ok(gql.includes('hasNextPage endCursor') && gql.includes('MAX_PAGES'));
  assert.ok(gql.includes('UUID.test(orderId)'));
});
test('driver/vehicle names come from the entity snapshot columns (same as REST)', () => {
  assert.ok(gql.includes('driverNameSnapshot') && gql.includes('plateNumberSnapshot'));
  assert.ok(gql.includes('driverName: s.driverNameSnapshot') && gql.includes('plateNumber: s.plateNumberSnapshot'));
});
test('warehouse code and order code are one batched request, no per-row calls', () => {
  assert.ok(gql.includes('warehouses(first: 100, where: { id: { in: $warehouseIds } })'));
  assert.ok(gql.includes('salesOrders(first: 1, where: { id: { eq: $orderId } })'));
});
test('list is GraphQL; all shipment writes and driver/vehicle lookups stay REST', () => {
  assert.ok(api.includes('list: (orderId: string) => fetchShipmentsForOrder(orderId)'));
  for (const w of ['/issue`', '/assignment`', '/dispatch`', '/exception/resolve`']) assert.ok(api.includes(w), w);
  assert.ok(api.includes("'/deliveries/drivers'") && api.includes("'/deliveries/vehicles'"));
});
