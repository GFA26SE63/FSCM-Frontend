import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(file, http) {
  const source = fs.readFileSync(new URL('../src/features/' + file, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => {
    if (name === '@/shared/api/http') return http;
    if (name === '@/shared/lib') return { env: { useMock: false } };
    throw new Error('Unexpected import ' + name);
  } });
  return exports;
}
function fixture() {
  const calls = [];
  const order = { id: 'order-1', orderCode: 'DH-000001', status: 'Issued', lines: [] };
  const vehicle = { id: 'vehicle-1', plateNumber: '51A', capacity: 10, warehouseId: 'south' };
  const driver = { id: 'driver-1', code: 'DRV1', warehouseId: 'south' };
  const part = { id: 'part-south', warehouseId: 'south', status: 'Issued', version: 4, totalQuantity: 8 };
  const http = {
    get: async path => {
      if (path.startsWith('/orders/')) return order;
      if (path === '/shipments') return [part];
      throw new Error(path);
    },
    getAll: async path => path === '/deliveries/vehicles' ? [vehicle] : [driver],
    post: async (path, body) => { calls.push({ method: 'POST', path, body }); return []; },
    http: { patch: async (path, body) => { calls.push({ method: 'PATCH', path, body }); return { data: part }; } },
  };
  return { ...load('orders/api.ts', http), ...load('allocation/api.ts', http), calls, vehicle, driver, part };
}
test('wave picking issues through the allocation-run API', async () => {
  const f = fixture(); await f.allocationApi.issuePicking('run-1');
  assert.equal(f.calls[0].method, 'POST');
  assert.equal(f.calls[0].path, '/allocation-runs/run-1/picking-lists');
});
test('assigns the selected warehouse shipment, with its version, without legacy dispatch', async () => {
  const f = fixture(); await f.orderApi.dispatch({ code: 'DH-000001', shipmentId: 'part-south', plate: '51A', driverCode: 'DRV1' });
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].path, '/shipments/part-south/assignment');
  assert.equal(f.calls[0].body.expectedVersion, 4);
  assert.equal(f.calls[0].body.driverId, 'driver-1');
  assert.equal(f.calls[0].body.vehicleId, 'vehicle-1');
});
test('refuses a vehicle from a different warehouse before submitting assignment', async () => {
  const f = fixture(); f.vehicle.warehouseId = 'north';
  await assert.rejects(f.orderApi.dispatch({ code: 'DH-000001', shipmentId: 'part-south', plate: '51A', driverCode: 'DRV1' }));
  assert.equal(f.calls.length, 0);
});
test('checks vehicle capacity against the selected shipment', async () => {
  const f = fixture(); f.vehicle.capacity = 7;
  await assert.rejects(f.orderApi.dispatch({ code: 'DH-000001', shipmentId: 'part-south', plate: '51A', driverCode: 'DRV1' }));
  assert.equal(f.calls.length, 0);
});
