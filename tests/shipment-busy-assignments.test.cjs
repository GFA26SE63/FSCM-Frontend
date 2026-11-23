const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const transportRows = {
  entities: {
    shipments: {
      nodes: [
        { status: 'Ready', driverId: 'ready-driver', vehicleId: 'ready-vehicle' },
        { status: 'Issued', driverId: 'issued-driver', vehicleId: 'issued-vehicle' },
        { status: 'Delivering', driverId: 'delivery-driver', vehicleId: 'delivery-vehicle' },
      ],
    },
    warehouseTransfers: {
      nodes: [{ status: 'InTransit', driverId: 'transfer-driver', vehicleId: 'transfer-vehicle' }],
    },
  },
};

const mocks = {
  '@/shared/api/http': {},
  '@/shared/api/graphql': { graphql: async () => transportRows },
  '@/shared/api/errors': { ApiError: class ApiError extends Error {} },
  './shipmentsGraphql': {},
};
const filename = path.resolve(__dirname, '../src/features/shipments/api.ts');
const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const mod = { exports: {} };
new Function('require', 'exports', 'module', code)(name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), mod.exports);

test('only active delivery and in-transit transfer resources are hidden from assignment', async () => {
  const busy = await mod.exports.shipmentsApi.busyAssignments();

  assert.deepEqual([...busy.busyDriverIds].sort(), ['delivery-driver', 'transfer-driver']);
  assert.deepEqual([...busy.busyVehicleIds].sort(), ['delivery-vehicle', 'transfer-vehicle']);
});
