const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function warehouseApi() {
  const filename = path.resolve(__dirname, '../src/features/warehouses/api.ts');
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  const requireStub = (id) => {
    if (id === '@/shared/api/http') return {};
    if (id === '@/shared/api/graphql') return {};
    return require(id);
  };
  new Function('require', 'module', 'exports', code)(requireStub, module, module.exports);
  return module.exports;
}

test('warehouse distances convert canonical metres to rounded kilometres', () => {
  const { normalizeRetailerDistanceKm } = warehouseApi();
  assert.deepEqual(normalizeRetailerDistanceKm({ distanceMeters: 15389.8 }), {
    km: 15.4,
    correctedLegacyMeters: false,
  });
});

test('warehouse distances repair legacy metre values mislabeled as kilometres', () => {
  const { normalizeRetailerDistanceKm } = warehouseApi();
  assert.deepEqual(normalizeRetailerDistanceKm({ distanceKm: 15389.8 }), {
    km: 15.4,
    correctedLegacyMeters: true,
  });
  assert.deepEqual(normalizeRetailerDistanceKm({ km: 19.96 }), {
    km: 20,
    correctedLegacyMeters: false,
  });
});
