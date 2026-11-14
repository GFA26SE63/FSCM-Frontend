import { expect, test, type Page } from '@playwright/test';

/*
 * Live check: Goods Receipt "Người tạo / Người phê duyệt" show real names, never user IDs.
 * Real Backend, read-only (login + list/detail reads). Run on demand only:
 *   FSCM_LIVE_EMAIL=... FSCM_LIVE_PASSWORD=... npx playwright test receipts-users-live
 */
const EMAIL = process.env.FSCM_LIVE_EMAIL ?? '';
const PASSWORD = process.env.FSCM_LIVE_PASSWORD ?? '';
test.skip(!EMAIL || !PASSWORD, 'Set FSCM_LIVE_EMAIL / FSCM_LIVE_PASSWORD to run against the real Backend.');

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{8}…/i;

async function login(page: Page) {
  await page.goto('/login');
  await page.getByPlaceholder('Nhập email tài khoản FSCM').first().fill(EMAIL);
  await page.getByPlaceholder('Nhập mật khẩu').fill(PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

const field = (page: Page, label: string) => page.locator('.fv', { has: page.locator('.fl', { hasText: label }) }).locator('.fval');

test('list and detail show creator / approver names, pending shows "Chưa duyệt", no IDs, no extra user requests', async ({ page }) => {
  const userRequests: string[] = [];
  const writes: string[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (/\/api\/v1\/users\//.test(u.pathname)) userRequests.push(u.pathname);
    if (u.pathname.startsWith('/api/v1/') && !['GET', 'OPTIONS'].includes(r.method()) && !u.pathname.includes('/auth/')) writes.push(`${r.method()} ${u.pathname}`);
  });
  await login(page);
  await page.goto('/receipts');
  const rows = page.locator('table.tbl tbody tr');
  await expect(rows.first()).toBeVisible();
  const header = await page.locator('table.tbl thead th').allInnerTexts();
  const col = header.findIndex((h) => h.trim() === 'Người tạo');
  expect(col).toBeGreaterThanOrEqual(0);
  const creatorCells = rows.locator(`td:nth-child(${col + 1})`);
  await expect.poll(async () => (await creatorCells.allInnerTexts()).some((t) => t.includes('…'))).toBe(false);
  const creators = await creatorCells.allInnerTexts();
  expect(creators.length).toBeGreaterThan(0);
  for (const c of creators) {
    expect(c.trim()).not.toBe('');
    expect(c).not.toMatch(UUID);
  }
  console.log('creators shown:', [...new Set(creators.map((c) => c.trim()))].join(' | '));

  // Approved receipt detail.
  const approvedRow = rows.filter({ hasNotText: 'Chờ duyệt' }).first();
  await approvedRow.locator('td').first().click();
  await expect(field(page, 'Người tạo phiếu')).toBeVisible();
  await expect.poll(() => field(page, 'Người phê duyệt').innerText()).not.toBe('…');
  const createdBy = await field(page, 'Người tạo phiếu').innerText();
  const approvedBy = await field(page, 'Người phê duyệt').innerText();
  console.log('approved receipt → creator:', createdBy, '| approver:', approvedBy);
  expect(createdBy).not.toMatch(UUID);
  expect(approvedBy).not.toMatch(UUID);
  expect(approvedBy).not.toBe('Chưa duyệt');

  // Pending receipt detail.
  await page.goBack();
  const pendingRow = rows.filter({ hasText: 'Chờ duyệt' }).first();
  if (await pendingRow.count()) {
    await pendingRow.locator('td').first().click();
    await expect(field(page, 'Người phê duyệt')).toHaveText('Chưa duyệt');
    expect(await field(page, 'Người tạo phiếu').innerText()).not.toMatch(UUID);
  }

  const distinct = new Set(userRequests);
  console.log('GET /users/{id} requests:', userRequests.length, 'distinct:', distinct.size);
  expect(userRequests.length).toBe(distinct.size); // no duplicate lookups
  expect(writes).toEqual([]);
  await expect(page.locator('body')).not.toContainText(/AUTH_NOT|HC00|Forbidden|403/);
});
