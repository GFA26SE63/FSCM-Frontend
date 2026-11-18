import { expect, test, type Page } from '@playwright/test';

/*
 * Runtime check of list-state persistence (URL query params + back-to-list memory + scroll).
 * API responses are test fixtures served by Playwright route interception – nothing is added to the app.
 */

const STATUSES = ['Delivering', 'Delivered', 'Quoted'] as const;
const orders = Array.from({ length: 90 }, (_, i) => ({
  id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
  orderCode: `SO-${String(i + 1).padStart(4, '0')}`,
  retailerId: 'r1', retailerCode: `RT-${i % 4}`, retailerName: `Cửa hàng ${i % 4}`,
  salesGroupId: 'g1', createdByUserId: 'u1',
  status: STATUSES[i % 3], paymentMethod: null, finalAmount: 1000, indicativeAmount: 1000, officialAmount: null,
  finalPricePendingAllocation: false, allocationState: 'Done', allocationRunId: null, allocationProposalStatus: null,
  allocationResult: null, shipmentCount: 0, totalCartons: 5, lineCount: 1,
  source: i % 2 ? 'Offline' : 'Assisted', version: 1,
  createdAt: `2026-11-${String((i % 10) + 1).padStart(2, '0')}T08:00:00Z`,
}));

const users = Array.from({ length: 45 }, (_, i) => ({
  id: `u-${i + 1}`, email: `user${i + 1}@example.test`, fullName: `Người dùng ${i + 1}`, phone: '',
  role: i % 2 ? 'Operator' : 'WarehouseKeeper', isActive: true, identityProvider: 'Local',
  createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z',
}));

const vehicles = Array.from({ length: 3 }, (_, i) => ({ id: `v${i}`, warehouseId: 'w1', plateNumber: `51C-00${i}`, vehicleType: 'Tải', capacity: 100, isActive: true }));
const drivers = Array.from({ length: 3 }, (_, i) => ({ id: `d${i}`, warehouseId: 'w1', code: `TX-0${i}`, fullName: `Tài xế ${i}`, phone: '090', licenseNumber: 'B2', isActive: true }));

async function setup(page: Page) {
  const calls: { path: string; search: URLSearchParams }[] = [];
  await page.addInitScript(() => sessionStorage.setItem('fscm.portal.session.v1', JSON.stringify({
    id: 'list-state-session', remember: false, accessToken: 'token', accessTokenExpiresAt: '2099-01-01',
    refreshToken: 'refresh', refreshTokenExpiresAt: '2099-01-01',
  })));
  await page.route('**/graphql', async (route) => {
    const body = JSON.parse(route.request().postData() ?? '{}') as { query?: string; variables?: { after?: string; before?: string; st?: string } };
    if (!body.query?.includes('salesOrders(')) return route.fulfill({ json: { data: {} } });
    const filtered = body.variables?.st ? orders.filter((order) => order.status === body.variables?.st) : orders;
    const pageSize = Number(body.query.match(/(?:first|last): (\d+)/)?.[1] ?? 20);
    const after = body.variables?.after ? Number(Buffer.from(body.variables.after, 'base64').toString()) : 0;
    const before = body.variables?.before ? Number(Buffer.from(body.variables.before, 'base64').toString()) : undefined;
    const start = before === undefined ? after : Math.max(0, before - pageSize);
    const nodes = filtered.slice(start, start + pageSize).map(({ retailerCode, retailerName, ...order }) => ({
      ...order, retailerCodeSnapshot: retailerCode, retailerNameSnapshot: retailerName,
    }));
    return route.fulfill({ json: { data: { entities: { page: {
      nodes, totalCount: filtered.length,
      pageInfo: { hasPreviousPage: start > 0, hasNextPage: start + nodes.length < filtered.length,
        startCursor: nodes.length ? Buffer.from(String(start)).toString('base64') : null,
        endCursor: nodes.length ? Buffer.from(String(start + nodes.length)).toString('base64') : null },
    } } } } });
  });
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^.*\/api\/v1/, '');
    calls.push({ path, search: url.searchParams });
    const q = url.searchParams;
    if (path === '/auth/me') return route.fulfill({ json: { id: 'admin', email: 'admin@example.test', fullName: 'Admin', role: 'Admin' } });
    if (path.startsWith('/orders/')) {
      return route.fulfill({ status: 404, json: { title: 'Không tìm thấy đơn hàng', status: 404 } });
    }
    if (path === '/users') {
      const term = (q.get('search') ?? '').toLowerCase();
      const role = q.get('role');
      const list = users.filter((u) => (!term || u.fullName.toLowerCase().includes(term) || u.email.includes(term)) && (!role || u.role === role));
      const p = Number(q.get('page') ?? 1); const size = Number(q.get('pageSize') ?? 20);
      return route.fulfill({ json: { items: list.slice((p - 1) * size, p * size), page: p, pageSize: size, totalCount: list.length } });
    }
    if (path.startsWith('/users/')) {
      const u = users.find((x) => x.id === decodeURIComponent(path.split('/')[2]));
      return route.fulfill({ json: { ...u, scope: { regionIds: [], warehouseIds: [], salesGroupIds: [], retailerIds: [] }, assignments: { regions: [], warehouses: [], salesGroups: [], retailers: [] } } });
    }
    if (path === '/dashboard') {
      return route.fulfill({ json: {
        role: 'Admin', asOf: '2026-11-12T00:00:00Z', fromDate: q.get('fromDate'), toDate: q.get('toDate'),
        scope: { isGlobal: true, hasAssignments: true, description: 'Toàn hệ thống', regions: [], warehouses: [], salesGroups: [] },
        cards: [], ordersByStatus: [], revenueByDay: [], topProducts: [], salesTeam: [], inventory: [], expiryRisks: [],
        workItems: [], customers: [], health: null, unattributedRevenue: null, notes: [],
      } });
    }
    if (path === '/deliveries/vehicles') return route.fulfill({ json: vehicles });
    if (path === '/deliveries/drivers') return route.fulfill({ json: drivers });
    return route.fulfill({ json: [] });
  });
  return calls;
}

const params = (page: Page) => new URL(page.url()).searchParams;
const label = (page: Page, text: string) => page.locator('label.lbl', { hasText: text });

test('Orders: filters, search, date and page survive detail → back / breadcrumb / refresh / forward', async ({ page }) => {
  const calls = await setup(page);
  await page.goto('/orders?size=10');
  await expect(page.locator('table.tbl tbody tr')).toHaveCount(10);

  await label(page, 'Trạng thái').locator('select').selectOption('Delivering');
  await label(page, 'Từ ngày').locator('input').fill('2026-11-02');
  await label(page, 'Tìm kiếm').locator('input').fill('Cửa hàng');
  await expect.poll(() => params(page).get('q')).toBe('Cửa hàng');
  await page.locator('.pager').getByRole('button', { name: '2', exact: true }).click();

  expect(params(page).get('status')).toBe('Delivering');
  expect(params(page).get('from')).toBe('2026-11-02');
  expect(params(page).get('q')).toBe('Cửa hàng');
  expect(params(page).get('page')).toBe('2');
  const listUrl = page.url();
  const firstRowOnPage2 = (await page.locator('table.tbl tbody tr').first().locator('td').first().innerText()).trim();

  // Client-side search / filters must not re-request the list.
  // 1) Browser Back
  await page.locator('table.tbl tbody tr').first().click();
  await expect(page).toHaveURL(/\/orders\/0000/);
  await page.goBack();
  await expect(page).toHaveURL(listUrl);
  await expect(label(page, 'Trạng thái').locator('select')).toHaveValue('Delivering');
  await expect(label(page, 'Từ ngày').locator('input')).toHaveValue('2026-11-02');
  await expect(label(page, 'Tìm kiếm').locator('input')).toHaveValue('Cửa hàng');
  await expect(page.locator('.pager .btn-primary')).toHaveText('2');
  await expect(page.locator('table.tbl tbody tr').first().locator('td').first()).toHaveText(firstRowOnPage2);

  // 2) Browser Forward then Back again
  await page.goForward();
  await expect(page).toHaveURL(/\/orders\/0000/);

  // 3) Breadcrumb from detail
  await page.locator('.breadcrumbs').getByRole('link', { name: 'Đơn hàng' }).click();
  await expect(page).toHaveURL(listUrl);
  await expect(page.locator('.pager .btn-primary')).toHaveText('2');

  // 4) Refresh keeps state
  await page.reload();
  await expect(label(page, 'Trạng thái').locator('select')).toHaveValue('Delivering');
  await expect(page.locator('.pager .btn-primary')).toHaveText('2');

  // Changing a filter resets to page 1 and keeps the others.
  await label(page, 'Nguồn').locator('select').selectOption('Offline');
  expect(params(page).get('page')).toBeNull();
  expect(params(page).get('status')).toBe('Delivering');
  expect(params(page).get('q')).toBe('Cửa hàng');

  // Clearing the search removes only q.
  await label(page, 'Tìm kiếm').locator('input').fill('');
  await expect.poll(() => params(page).get('q')).toBeNull();
  expect(params(page).get('nguon')).toBe('Offline');

  // List filters are client-side where the GraphQL entity model does not expose a filter;
  // state changes must not mutate the GraphQL cursor request contract.
  expect(calls.filter((c) => c.path === '/orders')).toHaveLength(0);
});

test('Orders: invalid URL params fall back to safe defaults', async ({ page }) => {
  await setup(page);
  await page.goto('/orders?status=%3Cscript%3E&size=999&from=2026-99-99');
  await expect(page.locator('table.tbl tbody tr')).toHaveCount(20);
  await expect(label(page, 'Trạng thái').locator('select')).toHaveValue('');
  await expect(label(page, 'Từ ngày').locator('input')).toHaveValue('');
  await expect(page.getByRole('navigation', { name: 'Phân trang dữ liệu' })
    .getByRole('button', { name: '1', exact: true })).toHaveAttribute('aria-current', 'page');
});

test('Users (server paging): debounced search, filters and page restored via "← Quay lại"', async ({ page }) => {
  const calls = await setup(page);
  await page.goto('/users');
  await expect(page.locator('table.tbl tbody tr')).toHaveCount(20);
  const before = calls.filter((c) => c.path === '/users').length;

  await label(page, 'Tìm kiếm').locator('input').pressSequentially('người', { delay: 40 });
  await expect(page).toHaveURL(/q=ng%C6%B0%E1%BB%9Di/);
  await page.waitForTimeout(500);
  const searchCalls = calls.filter((c) => c.path === '/users').slice(before);
  expect(searchCalls.length).toBe(1);
  expect(searchCalls[0].search.get('search')).toBe('người');

  await label(page, 'Vai trò').locator('select').selectOption('Operator');
  await expect(page.locator('table.tbl tbody tr')).toHaveCount(20);
  await page.locator('.pager').getByRole('button', { name: '2', exact: true }).click();
  await expect(page.locator('table.tbl tbody tr')).toHaveCount(2);
  const listUrl = page.url();
  expect(params(page).get('role')).toBe('Operator');
  expect(params(page).get('page')).toBe('2');

  await page.locator('table.tbl tbody tr').first().locator('td').first().click();
  await expect(page).toHaveURL(/\/users\/u-/);
  await page.getByRole('button', { name: '← Quay lại' }).click();
  await expect(page).toHaveURL(listUrl);
  await expect(label(page, 'Tìm kiếm').locator('input')).toHaveValue('người');
  await expect(label(page, 'Vai trò').locator('select')).toHaveValue('Operator');
  await expect(page.locator('.pager .btn-primary')).toHaveText('2');
  const last = calls.filter((c) => c.path === '/users').at(-1)!;
  expect(last.search.get('page')).toBe('2');
  expect(last.search.get('role')).toBe('Operator');
});

test('Fleet: active tab and per-tab table state are kept separately and survive refresh', async ({ page }) => {
  await setup(page);
  await page.goto('/fleet');
  await label(page, 'Tìm kiếm').locator('input').fill('51C-001');
  await page.getByRole('tab', { name: /Tài xế/ }).click();
  await label(page, 'Tìm kiếm').locator('input').fill('Tài xế 2');
  expect(params(page).get('tab')).toBe('drivers');
  expect(params(page).get('vehicles.q')).toBe('51C-001');
  expect(params(page).get('drivers.q')).toBe('Tài xế 2');

  await page.reload();
  await expect(page.getByRole('tab', { name: /Tài xế/ })).toHaveAttribute('aria-selected', 'true');
  await expect(label(page, 'Tìm kiếm').locator('input')).toHaveValue('Tài xế 2');
  await expect(page.locator('table.tbl tbody tr')).toHaveCount(1);

  await page.getByRole('tab', { name: /Xe giao hàng/ }).click();
  await expect(label(page, 'Tìm kiếm').locator('input')).toHaveValue('51C-001');
  await expect(page.locator('table.tbl tbody tr')).toHaveCount(1);
});

test('Scroll position of a long list is restored when returning from a detail; a new screen opens at the top', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 420 });
  await setup(page);
  await page.goto('/orders?size=10');
  await expect(page.locator('table.tbl tbody tr')).toHaveCount(10);
  const scroller = page.locator('.page');
  await scroller.evaluate((el) => { el.scrollTop = 500; });
  await page.waitForTimeout(150);
  const saved = await scroller.evaluate((el) => el.scrollTop);
  expect(saved).toBeGreaterThan(300);

  await page.locator('table.tbl tbody tr').nth(6).locator('td').first().click();
  await expect(page).toHaveURL(/\/orders\/0000/);
  expect(await scroller.evaluate((el) => el.scrollTop)).toBe(0);

  await page.goBack();
  await expect(page).toHaveURL(/\/orders\?size=10$/);
  await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBe(saved);
});
