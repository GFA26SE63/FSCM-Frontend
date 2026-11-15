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
      mapsKey: 'test-maps-key',
      searchKey: 'test-search-key',
    },
    useMock: false,
  },
};

const geocodingModule = source('shared/lib/geocoding.ts', {
  './env': mockEnv,
});

const mapDocModule = source('shared/lib/mapDoc.ts', {
  './env': mockEnv,
  './geocoding': geocodingModule,
});

/** Minimal fetch stub returning VietMap-shaped JSON; records every request URL. */
function stubFetch(routes) {
  const calls = [];
  const original = global.fetch;
  global.fetch = async (url) => {
    calls.push(String(url));
    const u = new URL(String(url));
    const handler = routes[u.pathname];
    if (!handler) return { ok: false, status: 404, json: async () => ({}) };
    const body = await handler(u.searchParams);
    if (body instanceof Error) throw body;
    return { ok: true, status: 200, json: async () => body };
  };
  return { calls, restore: () => { global.fetch = original; } };
}

test('Shared MapDoc: VietMap Street Map tiles with the Maps key only', () => {
  const doc = mapDocModule.buildMapDoc({
    center: [10.7769, 106.7009],
    points: [{ lat: 10.7769, lng: 106.7009, kind: 'ret', label: 'Đại lý An Bình', sub: '123 Đường Láng' }],
    interactivePick: true,
  });

  assert.ok(doc.includes('var C=[10.7769,106.7009]'));
  assert.ok(doc.includes('https://maps.vietmap.vn/api/tm/{z}/{x}/{y}@2x.png?apikey=test-maps-key'));
  assert.ok(!doc.includes('test-search-key'), 'search key must not be used for tiles');
  assert.ok(!doc.includes('openstreetmap'), 'no non-VietMap tile fallback');
  assert.ok(!doc.includes('/tiles/st/'), 'satellite style replaced by Street Map');
  assert.ok(doc.includes('Đại lý An Bình'));
  assert.ok(doc.includes('Điểm bán (Retailer)'));
  assert.ok(doc.includes("window.parent.postMessage({type:'mapPick'"));
  assert.ok(doc.includes('Không tải được bản đồ. Vui lòng thử lại sau.'));
});

test('Shared MapDoc: 20 km radius in meters with dashed outline', () => {
  const doc = mapDocModule.buildMapDoc({
    points: [{ lat: 10.8, lng: 106.6, kind: 'wh', label: 'WH-A · Kho A' }],
    radiusKm: 20,
  });
  assert.ok(doc.includes('R=20000'));
  assert.ok(doc.includes("dashArray:'6, 6'"));
  assert.ok(doc.includes('Bán kính 20 km'));
});

test('Shared MapDoc: points without real coordinates are not drawn and no substitute pin is placed', () => {
  const doc = mapDocModule.buildMapDoc({
    points: [
      { lat: null, lng: null, kind: 'ret', label: 'Không tọa độ' },
      { lat: 0, lng: 0, kind: 'ret', label: 'Tọa độ 0' },
      { lat: 10.8, lng: 106.6, kind: 'wh', label: 'WH-A' },
    ],
    interactivePick: true,
    pickPoint: null,
  });
  assert.ok(!doc.includes('Không tọa độ'));
  assert.ok(!doc.includes('Tọa độ 0'));
  assert.ok(doc.includes('var PIN=null'));
  assert.ok(!doc.includes('10.8744'), 'no hard-coded business coordinate');
});

test('Shared MapDoc: labels are HTML-escaped inside the map document', () => {
  const doc = mapDocModule.buildMapDoc({
    points: [{ lat: 10.8, lng: 106.6, kind: 'ret', label: '</script><img src=x onerror=alert(1)>' }],
  });
  assert.ok(!doc.includes('</script><img'));
  assert.ok(doc.includes('function esc('));
});

test('Shared Geocoding: forward geocoding uses VietMap Search v4 + Place v4 with the Search key', async () => {
  const f = stubFetch({
    '/api/search/v4': () => [{ ref_id: 'vm:1', display: '123 Nguyễn Huệ' }],
    '/api/place/v4': (q) => (q.get('refid') === 'vm:1' ? { lat: 10.7742510838, lng: 106.7029080101 } : {}),
  });
  try {
    const coords = await geocodingModule.forwardGeocode('123 Nguyễn Huệ, Quận 1');
    assert.deepEqual(coords, { lat: 10.7743, lng: 106.7029 });
    assert.ok(f.calls.every((u) => u.includes('apikey=test-search-key')));
    // Same address again → served without another request.
    await geocodingModule.forwardGeocode('123 Nguyễn Huệ, Quận 1');
    assert.equal(f.calls.length, 2);
  } finally {
    f.restore();
  }
});

test('Shared Geocoding: no match returns null and service failure throws – never a made-up location', async () => {
  const f = stubFetch({ '/api/search/v4': () => [] });
  try {
    assert.equal(await geocodingModule.forwardGeocode('Kho Hóc Môn'), null);
  } finally {
    f.restore();
  }
  const g = stubFetch({ '/api/search/v4': () => new Error('network') });
  try {
    await assert.rejects(geocodingModule.forwardGeocode('Địa chỉ khác'), { name: 'GeocodingError' });
  } finally {
    g.restore();
  }
  assert.equal(geocodingModule.KNOWN_LOCATIONS, undefined);
});

test('Shared Geocoding: reverse geocoding uses VietMap Reverse v4 and reports failures', async () => {
  const f = stubFetch({ '/api/reverse/v4': () => [{ display: '86 Lê Thánh Tôn, Phường Sài Gòn, TP. Hồ Chí Minh' }] });
  try {
    assert.equal(await geocodingModule.reverseGeocode(10.7769, 106.7009), '86 Lê Thánh Tôn, Phường Sài Gòn, TP. Hồ Chí Minh');
    assert.ok(f.calls[0].includes('/api/reverse/v4') && f.calls[0].includes('apikey=test-search-key'));
  } finally {
    f.restore();
  }
  const g = stubFetch({ '/api/reverse/v4': () => new Error('down') });
  try {
    await assert.rejects(geocodingModule.reverseGeocode(10.5, 106.5), { name: 'GeocodingError' });
  } finally {
    g.restore();
  }
});

test('Shared Geocoding: latest-request guard rejects outdated responses', () => {
  const guard = geocodingModule.createLatestGuard();
  const first = guard.next();
  const second = guard.next();
  assert.equal(guard.isLatest(first), false);
  assert.equal(guard.isLatest(second), true);
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

  // Keystroke typing must NOT reload map: initial pin is a stable useMemo, no substitute coordinates
  assert.ok(pickerFile.includes('const initialPin = useMemo<[number, number] | null>'));
  assert.ok(pickerFile.includes('// eslint-disable-next-line react-hooks/exhaustive-deps'));
  assert.ok(!pickerFile.includes('initialAnchor'), 'no substitute anchor coordinates');

  // Map picks accepted only from this picker's own maps; outdated reverse results ignored
  assert.ok(pickerFile.includes('useMapPickMessages(frames, handleMapPick)'));
  assert.ok(pickerFile.includes("reverseGeocode(safeLat, safeLng)"));
  assert.ok(pickerFile.includes('reverseGuard.isLatest(requestId)'));

  // Failure preserves coordinates
  assert.ok(pickerFile.includes("onCoordinatesChange?.(safeLat, safeLng)"));

  // No technical jargon in UI messages
  assert.ok(!pickerFile.includes('API endpoint'));
  assert.ok(!pickerFile.includes('Nominatim error'));
  assert.ok(!pickerFile.includes('Vietmap error'));
  assert.ok(!pickerFile.includes('HTTP 500'));
});
