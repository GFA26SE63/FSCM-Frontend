const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const calls = [];
const transportRows = { entities: { busyTransportRead: {
  driverIds: ['delivery-driver', 'transfer-driver'],
  vehicleIds: ['delivery-vehicle', 'transfer-vehicle'],
} } };

const mocks = {
  '@/shared/api/http': {},
  '@/shared/api/graphql': { graphql: async query => { calls.push(query); return transportRows; } },
  '@/shared/api/errors': { ApiError: class ApiError extends Error {} },
  './shipmentsGraphql': {},
};
const filename = path.resolve(__dirname, '../src/features/shipments/api.ts');
const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const mod = { exports: {} };
new Function('require', 'exports', 'module', code)(name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), mod.exports);

test('dispatch reads server resource availability without requiring transfer-screen access', async () => {
  const busy = await mod.exports.shipmentsApi.busyAssignments();

  assert.match(calls[0], /busyTransportRead/);
  assert.doesNotMatch(calls[0], /warehouseTransfers/);
  assert.deepEqual([...busy.busyDriverIds].sort(), ['delivery-driver', 'transfer-driver']);
  assert.deepEqual([...busy.busyVehicleIds].sort(), ['delivery-vehicle', 'transfer-vehicle']);
});
