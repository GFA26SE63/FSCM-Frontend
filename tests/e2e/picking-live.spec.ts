import { expect, test, type Page, type Request } from '@playwright/test';

/*
 * Live check of Picking List server-side pagination against the real Backend (read-only usage:
 * login + list reads). Run on demand only:
 *   FSCM_LIVE_EMAIL=... FSCM_LIVE_PASSWORD=... npx playwright test picking-live
 */
const EMAIL = process.env.FSCM_LIVE_EMAIL ?? '';
const PASSWORD = process.env.FSCM_LIVE_PASSWORD ?? '';
test.skip(!EMAIL || !PASSWORD, 'Set FSCM_LIVE_EMAIL / FSCM_LIVE_PASSWORD to run against the real Backend.');

const isPageQuery = (r: Request) => r.url().endsWith('/graphql') && (r.postData() ?? '').includes('query PickingListPage');
const cards = (page: Page) => page.locator('section.card', { has: page.getByRole('button', { name: /Xem chi tiết|Thu gọn/ }) });
const pager = (page: Page) => page.locator('.pager');

async function login(page: Page) {
  await page.goto('/login');
  await page.getByPlaceholder('Nhập email tài khoản FSCM').first().fill(EMAIL);
  await page.getByPlaceholder('Nhập mật khẩu').fill(PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

test('server-side pages, cursor navigation, URL state, filters, back/forward, refresh, invalid cursor', async ({ page }) => {
  const pageQueries: string[] = [];
  const writes: string[] = [];
  page.on('request', (r) => {
    if (isPageQuery(r)) pageQueries.push(r.postData() ?? '');
    if (r.url().includes('/api/v1/') && !['GET', 'OPTIONS'].includes(r.method()) && !r.url().includes('/auth/')) writes.push(`${r.method()} ${r.url()}`);
    if (r.url().includes('/graphql') && /mutation/.test(r.postData() ?? '')) writes.push('graphql mutation');
  });

  await login(page);
  await page.goto('/runpicking?size=10');
  await expect(cards(page)).toHaveCount(10);
  await expect(pager(page)).toContainText('Hiển thị 1–10 / 17');
  await expect(pager(page)).toContainText('Trang 1 / 2');
  expect(pageQueries.length).toBe(1);
  expect(pageQueries[0]).toContain('first: 10');
  await expect(page.getByRole('button', { name: 'Trước' })).toBeDisabled();

  // Next page: only the requested page is fetched.
  await page.getByRole('button', { name: 'Sau' }).click();
  await expect(pager(page)).toContainText('Hiển thị 11–17 / 17');
  await expect(cards(page)).toHaveCount(7);
  expect(new URL(page.url()).searchParams.get('after')).toBeTruthy();
  expect(new URL(page.url()).searchParams.get('page')).toBe('2');
  expect(pageQueries.length).toBe(2);

  // Refresh keeps page 2.
  await page.reload();
  await expect(pager(page)).toContainText('Trang 2 / 2');
  await expect(cards(page)).toHaveCount(7);

  // Browser Back → page 1, Forward → page 2.
  await page.goto('/orders');
  await page.goBack();
  await expect(pager(page)).toContainText('Trang 2 / 2');
  await page.getByRole('button', { name: 'Trước' }).click();
  await expect(pager(page)).toContainText('Trang 1 / 2');
  expect(new URL(page.url()).search).toBe('?size=10');

  // Page size change → page 1 with 20 per page.
  await page.getByLabel('Số phiếu mỗi trang').selectOption('20');
  await expect(cards(page)).toHaveCount(17);
  await expect(pager(page)).toContainText('Trang 1 / 1');

  // Status filter: server-side, resets paging, totals from the Backend.
  await page.locator('select').filter({ hasText: 'Tất cả trạng thái' }).selectOption({ label: 'Đã soạn xong' });
  await expect(pager(page)).toContainText('/ 11');
  await expect(page.locator('.stat', { hasText: 'Tổng phiếu' })).toContainText('11');
  expect(new URL(page.url()).searchParams.get('status')).toBe('Completed');

  // Expand a sheet: lines show SKU / batch.
  await cards(page).first().getByRole('button', { name: 'Xem chi tiết' }).click();
  await expect(cards(page).first().locator('table')).toBeVisible();

  // Invalid cursor in the URL → business message + way back.
  await page.goto('/runpicking?size=10&after=not-a-cursor&page=2');
  await expect(page.getByText('Trang đã chọn không còn hợp lệ. Hãy quay về trang đầu.')).toBeVisible();
  await page.getByRole('button', { name: 'Về trang đầu' }).click();
  await expect(pager(page)).toContainText('Trang 1 / 2');

  // Cursor past the end of the data (the Backend cursor is an offset; this is what a saved URL
  // looks like after the dataset shrinks): empty page with a way back, no broken range text.
  await page.goto(`/runpicking?size=10&after=${Buffer.from('999').toString('base64')}&page=5`);
  await expect(page.getByText('Trang đã chọn không còn phiếu soạn nào.')).toBeVisible();
  await expect(pager(page)).toContainText('Hiển thị 0–0 / 17');
  await page.getByRole('button', { name: 'Về trang đầu' }).click();
  await expect(cards(page)).toHaveCount(10);

  expect(writes).toEqual([]);
});
