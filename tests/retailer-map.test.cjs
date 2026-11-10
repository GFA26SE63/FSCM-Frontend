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

const mockEnv = {
  env: {
    vietmap: {
      apiKey: 'test-vietmap-key',
    },
    useMock: false,
  },
};

const mapDocModule = source('shared/lib/mapDoc.ts', {
  './env': mockEnv,
});

const geocodingModule = source('shared/lib/geocoding.ts', {
  './env': mockEnv,
});

test('Shared MapDoc: buildMapDoc renders Leaflet iframe with safe coordinates and legend', () => {
  const doc = mapDocModule.buildMapDoc({
    center: [10.8744, 106.6511],
    points: [
      {
        lat: 10.8744,
        lng: 106.6511,
        kind: 'ret',
        label: 'Đại lý An Bình',
        sub: '123 Đường Láng',
      },
    ],
    interactivePick: true,
  });

  assert.ok(doc.includes('var C=[10.8744,106.6511]'));
  assert.ok(doc.includes('Đại lý An Bình'));
  assert.ok(doc.includes('test-vietmap-key'));
  assert.ok(doc.includes('Điểm bán (Retailer)'));
  assert.ok(doc.includes("window.parent.postMessage({type:'mapPick'"));
  assert.ok(doc.includes("window.parent.postMessage({type:'fscm:pick-coords'"));
});

test('Shared Geocoding: forwardGeocode matches known locations or calls external API', async () => {
  // Test fast matching with known HCM landmarks
  const coords = await geocodingModule.forwardGeocode('Kho Hóc Môn, TP. Hồ Chí Minh');
  assert.ok(coords);
  assert.equal(coords.lat, 10.8891);
  assert.equal(coords.lng, 106.5912);

  const coordsQ12 = await geocodingModule.forwardGeocode('Khu vực Thới An Q12');
  assert.ok(coordsQ12);
  assert.equal(coordsQ12.lat, 10.8744);
  assert.equal(coordsQ12.lng, 106.6511);
});

test('Shared Geocoding: reverseGeocode resolves coordinates to nearest readable address', async () => {
  const addr = await geocodingModule.reverseGeocode(10.8891, 106.5912);
  assert.ok(addr);
  assert.ok(addr.includes('Hóc Môn') || addr.includes('Hồ Chí Minh'));
});

test('Warehouse re-exports: warehouseMap and geocoding continue to export shared functions', () => {
  const whMapFile = fs.readFileSync(path.resolve(__dirname, '../src/features/warehouses/components/warehouseMap.ts'), 'utf8');
  assert.ok(whMapFile.includes("@/shared/lib/mapDoc"));

  const whGeoFile = fs.readFileSync(path.resolve(__dirname, '../src/features/warehouses/lib/geocoding.ts'), 'utf8');
  assert.ok(whGeoFile.includes("@/shared/lib/geocoding"));
});

test('Retailer Detail Page: view mode displays map when coordinates exist, or "Chưa có vị trí trên bản đồ." when missing', () => {
  const detailFile = fs.readFileSync(path.resolve(__dirname, '../src/features/retailers/pages/RetailerDetailPage.tsx'), 'utf8');

  // Integrates AddressLocationPicker in view mode
  assert.ok(detailFile.includes('<AddressLocationPicker'));
  assert.ok(detailFile.includes('mode="view"'));
  assert.ok(detailFile.includes('address={r.address}'));
  assert.ok(detailFile.includes('lat={hasCoordinates ? Number(lat) : null}'));
  assert.ok(detailFile.includes('lng={hasCoordinates ? Number(lng) : null}'));
  assert.ok(detailFile.includes('entityKind="ret"'));

  // Strict coordinate validation: non-zero, finite
  assert.ok(detailFile.includes('Number(lat) !== 0'));
  assert.ok(detailFile.includes('Number(lng) !== 0'));

  // Preserves Google Maps link and location version
  assert.ok(detailFile.includes('Mở trên Google Maps'));
  assert.ok(detailFile.includes('Phiên bản vị trí'));
});

test('Retailer Form Dialog: uses AddressLocationPicker with "Định vị" and synchronized coordinates', () => {
  const formFile = fs.readFileSync(path.resolve(__dirname, '../src/features/retailers/components/RetailerFormDialog.tsx'), 'utf8');

  // Uses AddressLocationPicker in edit mode
  assert.ok(formFile.includes('<AddressLocationPicker'));
  assert.ok(formFile.includes('mode="edit"'));
  assert.ok(formFile.includes('onAddressChange={(newAddr) => set(\'address\', newAddr)}'));
  assert.ok(formFile.includes('onCoordinatesChange={(newLat, newLng) => {'));
  assert.ok(formFile.includes("set('lat', newLat)"));
  assert.ok(formFile.includes("set('lng', newLng)"));

  // Submits real coordinates in Update declaration payload
  assert.ok(formFile.includes('latitude: lat'));
  assert.ok(formFile.includes('longitude: lng'));
  assert.ok(formFile.includes('address: String(v.address).trim()'));

  // No mock data or fake coordinate generator
  assert.ok(!formFile.includes('Math.random()'));
  assert.ok(!formFile.includes('mockRetailer'));
});

test('AddressLocationPicker Component: adheres to strict UI rules and Vietnamese messaging', () => {
  const pickerFile = fs.readFileSync(path.resolve(__dirname, '../src/shared/ui/AddressLocationPicker.tsx'), 'utf8');

  // Exact required user-facing messages
  assert.ok(pickerFile.includes('Không tìm thấy vị trí phù hợp với địa chỉ đã nhập.'));
  assert.ok(pickerFile.includes('Không thể xác định địa chỉ tại vị trí này.'));
  assert.ok(pickerFile.includes('Chưa có vị trí trên bản đồ.'));
  assert.ok(pickerFile.includes('Vui lòng nhập địa chỉ trước khi định vị.'));
  assert.ok(pickerFile.includes('Đang định vị…'));
  assert.ok(pickerFile.includes('Định vị'));
  assert.ok(pickerFile.includes('Mở bản đồ lớn'));

  // Keystroke typing must NOT reload map: initialAnchor is stable useMemo
  assert.ok(pickerFile.includes('const initialAnchor = useMemo<[number, number]>'));
  assert.ok(pickerFile.includes('// eslint-disable-next-line react-hooks/exhaustive-deps'));

  // Map postMessage listener for interactive picking
  assert.ok(pickerFile.includes("e.data?.type === 'mapPick' || e.data?.type === 'fscm:pick-coords'"));
  assert.ok(pickerFile.includes("reverseGeocode(safeLat, safeLng)"));

  // Failure preserves coordinates
  assert.ok(pickerFile.includes("onCoordinatesChange?.(safeLat, safeLng)"));

  // No technical jargon in UI messages
  assert.ok(!pickerFile.includes('API endpoint'));
  assert.ok(!pickerFile.includes('Nominatim error'));
  assert.ok(!pickerFile.includes('Vietmap error'));
  assert.ok(!pickerFile.includes('HTTP 500'));
});
