import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('operator reports filter, show details, switch kinds and export every page', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('fscm.portal.session.v1', JSON.stringify({
    id: 'report-session', remember: false, accessToken: 'test', accessTokenExpiresAt: '2099-01-01',
    refreshToken: 'test', refreshTokenExpiresAt: '2099-01-01',
  })));
  const requests: URL[] = [];
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/auth/me')) return route.fulfill({ json: { id: 'op', email: 'op@test.local', fullName: 'Report Operator', role: 'Operator' } });
    if (url.pathname.endsWith('/regions')) return route.fulfill({ json: [{ id: 'region-hcm', name: 'Hồ Chí Minh' }] });
    if (!url.pathname.includes('/reports/operations/')) return route.fulfill({ json: [] });
    requests.push(url);
    const pageNumber = Number(url.searchParams.get('page'));
    const pageSize = Number(url.searchParams.get('pageSize'));
    const start = (pageNumber - 1) * pageSize;
    const items = Array.from({ length: Math.min(pageSize, 201 - start) }, (_, i) => ({
      id: `request-${start + i}`, at: '2026-11-12T01:00:00Z', retailerName: 'Cửa hàng An Phú', retailerCode: 'RT01',
      programCode: 'LP01', programName: '=UNSAFE()', itemCode: 'GIFT01', itemName: 'Bình nước', status: 'Completed',
      quantity: 2, points: 200, balanceAfter: 800, grossAmount: 10000, discountAmount: 1000, netAmount: 9000,
      approvedByUserId: 'operator-approver', approvedAt: '2026-11-12T02:00:00Z', note: 'Ghi chú kiểm tra',
      approvedByName: 'Nguyễn Văn Duyệt', regionName: 'Hồ Chí Minh', campaignDiscountAmount: 600, shelfLifeDiscountAmount: 400,
    }));
    return route.fulfill({ json: { items, totalCount: 201, page: pageNumber, pageSize, summary: [{ label: 'Số bản ghi', value: 201 }], notes: ['Dữ liệu kiểm thử'] } });
  });
  await page.goto('/reports?kind=redemptions');
  await expect(page.getByRole('heading', { name: 'Báo cáo chương trình & đổi quà' })).toBeVisible();
  await page.getByRole('button', { name: 'Chi tiết', exact: true }).first().click();
  await expect(page.getByText('operator-approver', { exact: true })).toBeVisible();
  await expect(page.getByText('Nguyễn Văn Duyệt', { exact: true })).toBeVisible();
  await page.getByLabel('Khu vực', { exact: true }).selectOption('region-hcm');
  await page.getByPlaceholder('Mã hoặc tên retailer').fill('An Phú');
  await page.getByRole('button', { name: 'Xem báo cáo', exact: true }).click();
  await expect.poll(() => requests.at(-1)?.searchParams.get('retailer')).toBe('An Phú');
  await expect.poll(() => requests.at(-1)?.searchParams.get('regionId')).toBe('region-hcm');
  await page.getByRole('button', { name: 'Sau', exact: true }).click();
  await expect.poll(() => requests.at(-1)?.searchParams.get('page')).toBe('2');
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: /Xuất CSV/ }).click();
  const download = await downloadEvent;
  const csv = await readFile((await download.path())!, 'utf8');
  expect(csv.split('\r\n')).toHaveLength(202);
  expect(csv).toContain('request-200');
  expect(csv).toContain("'=UNSAFE()");
  expect(requests.filter(url => url.searchParams.get('pageSize') === '200')).toHaveLength(2);
  await page.getByRole('tab', { name: 'Biến động loyalty', exact: true }).click();
  await expect.poll(() => requests.at(-1)?.pathname).toContain('/loyalty');
  await page.getByRole('tab', { name: 'Sử dụng khuyến mãi', exact: true }).click();
  await expect.poll(() => requests.at(-1)?.pathname).toContain('/promotions');
  await expect(page.getByRole('columnheader', { name: 'Tiền giảm (đ)' })).toBeVisible();
});
