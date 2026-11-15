import { expect, test, type Frame, type Page } from '@playwright/test';

/*
 * Live VietMap verification: Street Map tiles, Search/Place/Reverse v4 are called on the real
 * VietMap services with the keys from .env. Portal backend responses are test fixtures.
 * Run only on demand:  VIETMAP_LIVE=1 npx playwright test vietmap-live
 */
test.skip(!process.env.VIETMAP_LIVE, 'Set VIETMAP_LIVE=1 to call the real VietMap services.');

const WH_A = {
  id: '11111111-1111-4111-8111-111111111111', code: 'WH-A', name: 'Kho A', address: 'Quận 1, TP. Hồ Chí Minh',
  latitude: 10.7769, longitude: 106.7009, regionId: 'r1', isActive: true, capacityPallets: 100, minStock: 1,
};
const WH_NO_COORDS = { ...WH_A, id: '22222222-2222-4222-8222-222222222222', code: 'WH-B', name: 'Kho B', latitude: null, longitude: null };
const RETAILERS = [
  { id: 'r-1', code: 'RT-1', name: 'Cửa hàng Một', address: 'Quận 3', latitude: 10.7830, longitude: 106.6880 },
  { id: 'r-2', code: 'RT-2', name: 'Cửa hàng Không Tọa Độ', address: '—', latitude: null, longitude: null },
];

interface Net { vietmap: { url: string; status: number }[]; foreign: string[] }

async function setup(page: Page): Promise<Net> {
  const net: Net = { vietmap: [], foreign: [] };
  await page.addInitScript(() => sessionStorage.setItem('fscm.portal.session.v1', JSON.stringify({
    id: 'map-session', remember: false, accessToken: 'token', accessTokenExpiresAt: '2099-01-01',
    refreshToken: 'refresh', refreshTokenExpiresAt: '2099-01-01',
  })));
  page.on('response', (r) => {
    const url = r.url();
    if (url.includes('maps.vietmap.vn')) net.vietmap.push({ url: url.replace(/apikey=[^&]+/, 'apikey=***'), status: r.status() });
    if (/openstreetmap|nominatim|google\.com\/maps\/api|arcgis/.test(url)) net.foreign.push(url);
  });
  await page.route('**/graphql', (route) => {
    const body = route.request().postData() ?? '';
    if (body.includes('warehouses(')) return route.fulfill({ json: { data: { warehouses: [WH_A, WH_NO_COORDS] } } });
    return route.fulfill({ json: { data: null } });
  });
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^.*\/api\/v1/, '');
    if (path === '/auth/me') return route.fulfill({ json: { id: 'admin', email: 'admin@example.test', fullName: 'Admin', role: 'Admin' } });
    if (path === '/retailers') return route.fulfill({ json: { items: RETAILERS, totalCount: RETAILERS.length } });
    if (path === '/warehouses') return route.fulfill({ json: [WH_A, WH_NO_COORDS] });
    if (path === '/regions') return route.fulfill({ json: [{ id: 'r1', code: 'HCM', name: 'TP.HCM', isActive: true }] });
    return route.fulfill({ json: [] });
  });
  return net;
}

async function mapFrame(page: Page, title: string): Promise<Frame> {
  const handle = await page.locator(`iframe[title="${title}"]`).elementHandle();
  const frame = await handle!.contentFrame();
  await frame!.waitForSelector('.leaflet-tile-loaded', { timeout: 20_000 });
  return frame!;
}

const tilesOk = (net: Net) => net.vietmap.filter((r) => r.url.includes('/api/tm/'));

test('Warehouse network map: Street Map tiles, real points only, 20 km dashed radius', async ({ page }) => {
  const net = await setup(page);
  await page.goto('/whs');
  await page.getByRole('button', { name: /Bản đồ mạng lưới kho/ }).click();
  const frame = await mapFrame(page, 'Bản đồ mạng lưới kho');

  const tiles = tilesOk(net);
  expect(tiles.length).toBeGreaterThan(0);
  expect(tiles.every((t) => t.status === 200)).toBe(true);
  expect(tiles.every((t) => /\/api\/tm\/\d+\/\d+\/\d+@2x\.png/.test(t.url))).toBe(true);
  expect(net.foreign).toEqual([]);

  const layers = await frame.evaluate(() => {
    const out = { circles: [] as { r: number; dash: string | null }[], markers: 0, labels: [] as string[] };
    // @ts-expect-error Leaflet global inside the map document
    window.map.eachLayer((l) => {
      if (typeof l.getRadius === 'function' && l.options && 'radius' in l.options && l._mRadius !== undefined) {
        out.circles.push({ r: l.getRadius(), dash: l.options.dashArray ?? null });
      } else if (typeof l.getRadius === 'function') {
        out.markers += 1;
      }
    });
    document.querySelectorAll('.leaflet-tooltip').forEach((t) => out.labels.push(t.textContent ?? ''));
    return out;
  });
  expect(layers.circles).toEqual([{ r: 20000, dash: '6, 6' }]);
  expect(layers.markers).toBe(2); // WH-A + RT-1; points without coordinates are not drawn
  expect(layers.labels.some((l) => l.includes('Cửa hàng Không Tọa Độ'))).toBe(false);
  expect(layers.labels.some((l) => l.includes('WH-B'))).toBe(false);

  // Zoom control works.
  // @ts-expect-error Leaflet global
  const z0 = await frame.evaluate(() => window.map.getZoom());
  await frame.locator('.leaflet-control-zoom-in').click();
  // @ts-expect-error Leaflet global
  await expect.poll(() => frame.evaluate(() => window.map.getZoom())).toBe(z0 + 1);
});

test('Retailer create: no substitute pin; map click → coordinates + VietMap reverse address; "Định vị" → coordinates; typing does not reload', async ({ page }) => {
  const net = await setup(page);
  await page.goto('/retailers');
  await page.getByRole('button', { name: '+ Tạo retailer' }).click();
  const frame = await mapFrame(page, 'Bản đồ chọn vị trí');
  // @ts-expect-error Leaflet global
  expect(await frame.evaluate(() => window.mk === null)).toBe(true);

  const address = page.getByPlaceholder('Nhập địa chỉ và bấm Định vị hoặc chọn trên bản đồ');
  const latInput = page.locator('input[placeholder="Ví dụ: 10.8744"]');
  const lngInput = page.locator('input[placeholder="Ví dụ: 106.6511"]');

  // 1) Click the map → coordinates set immediately, then the VietMap address.
  const box = (await page.locator('iframe[title="Bản đồ chọn vị trí"]').boundingBox())!;
  await page.mouse.click(box.x + box.width / 2 + 30, box.y + box.height / 2 - 20);
  await expect(latInput).not.toHaveValue('');
  await expect.poll(() => net.vietmap.filter((r) => r.url.includes('/api/reverse/v4')).length).toBe(1);
  await expect(address).not.toHaveValue('', { timeout: 10_000 });
  const reversed = await address.inputValue();
  expect(reversed).toMatch(/Hồ Chí Minh|Phường|Quận/);
  // @ts-expect-error Leaflet global
  expect(await frame.evaluate(() => window.mk !== null)).toBe(true);

  // 2) Typing an address must not reload the map or call VietMap.
  await frame.evaluate(() => { (window as unknown as { __alive: boolean }).__alive = true; });
  const before = net.vietmap.filter((r) => !r.url.includes('/api/tm/')).length;
  await address.fill('');
  await address.pressSequentially('123 Nguyễn Huệ, Quận 1, Hồ Chí Minh', { delay: 15 });
  expect(await frame.evaluate(() => (window as unknown as { __alive?: boolean }).__alive)).toBe(true);
  expect(net.vietmap.filter((r) => !r.url.includes('/api/tm/')).length).toBe(before);

  // 3) "Định vị" → Search v4 + Place v4 → coordinates near Nguyễn Huệ.
  await page.getByRole('button', { name: 'Định vị', exact: true }).click();
  await expect.poll(async () => Number(await latInput.inputValue())).toBeCloseTo(10.774, 2);
  expect(Number(await lngInput.inputValue())).toBeCloseTo(106.703, 2);
  expect(net.vietmap.some((r) => r.url.includes('/api/search/v4') && r.status === 200)).toBe(true);
  expect(net.vietmap.some((r) => r.url.includes('/api/place/v4') && r.status === 200)).toBe(true);
  // Pin moved inside the same map document (no reload).
  expect(await frame.evaluate(() => (window as unknown as { __alive?: boolean }).__alive)).toBe(true);
  // @ts-expect-error Leaflet global
  const pin = await frame.evaluate(() => window.mk.getLatLng());
  expect(pin.lat).toBeCloseTo(10.774, 2);

  // 4) Same address again → no extra VietMap request (cached).
  const calls = net.vietmap.length;
  await page.getByRole('button', { name: 'Định vị', exact: true }).click();
  await page.waitForTimeout(500);
  expect(net.vietmap.filter((r) => !r.url.includes('/api/tm/')).length).toBe(net.vietmap.filter((r) => !r.url.includes('/api/tm/')).length);
  expect(net.vietmap.slice(calls).filter((r) => /search|place/.test(r.url))).toEqual([]);

  expect(net.foreign).toEqual([]);
  expect(tilesOk(net).every((t) => t.status === 200)).toBe(true);
});

test('Warehouse create: map pick → coordinates + reverse address; enlarged map opens at the current point and syncs back', async ({ page }) => {
  const net = await setup(page);
  await page.goto('/whs/new');
  const frame = await mapFrame(page, 'Bản đồ vị trí kho');
  const latInput = page.locator('input[step="0.0001"]').first();
  const address = page.getByPlaceholder('Nhập địa chỉ và bấm Định vị hoặc chọn trên bản đồ');

  // Existing points: real warehouse WH-A with 20 km radius; WH-B (no coordinates) is not drawn.
  const labels = await frame.locator('.leaflet-tooltip').allTextContents();
  expect(labels.some((l) => l.includes('WH-A'))).toBe(true);
  expect(labels.some((l) => l.includes('WH-B'))).toBe(false);

  const box = (await page.locator('iframe[title="Bản đồ vị trí kho"]').boundingBox())!;
  await page.mouse.click(box.x + box.width / 2 + 60, box.y + box.height / 2 + 30);
  await expect.poll(() => net.vietmap.filter((r) => r.url.includes('/api/reverse/v4')).length).toBe(1);
  await expect(address).not.toHaveValue('', { timeout: 10_000 });
  const picked = Number(await latInput.inputValue());
  // @ts-expect-error Leaflet global
  expect(await frame.evaluate(() => window.mk.getLatLng().lat)).toBeCloseTo(picked, 3);

  await page.getByText('Mở bản đồ phóng to').click();
  const big = await mapFrame(page, 'Bản đồ phóng to');
  // @ts-expect-error Leaflet global
  await expect.poll(() => big.evaluate(() => window.mk && window.mk.getLatLng().lat)).toBeCloseTo(picked, 3);

  const bigBox = (await page.locator('iframe[title="Bản đồ phóng to"]').boundingBox())!;
  await page.mouse.click(bigBox.x + bigBox.width / 2 - 120, bigBox.y + bigBox.height / 2 - 80);
  await expect.poll(async () => Number(await latInput.inputValue())).not.toBeCloseTo(picked, 3);
  const newLat = Number(await latInput.inputValue());
  // Embedded map follows the pick made in the enlarged map.
  // @ts-expect-error Leaflet global
  await expect.poll(() => frame.evaluate(() => window.mk.getLatLng().lat)).toBeCloseTo(newLat, 3);
  expect(net.foreign).toEqual([]);
});
