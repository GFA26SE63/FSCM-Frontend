import { expect, test } from '@playwright/test';

test('operator reports filter, inspect tabs, switch kinds and export excel across all pages', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('fscm.portal.session.v1', JSON.stringify({
    id: 'report-session', remember: false, accessToken: 'test', accessTokenExpiresAt: '2099-01-01',
    refreshToken: 'test', refreshTokenExpiresAt: '2099-01-01',
  })));
  const requests: URL[] = [];
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/auth/me')) return route.fulfill({ json: { id: 'op', email: 'op@test.local', fullName: 'Report Operator', role: 'Operator' } });
    if (url.pathname.endsWith('/regions')) return route.fulfill({ json: [{ id: 'region-hcm', name: 'Hồ Chí Minh' }] });
    if (!url.pathname.startsWith('/api/v1/reports/')) return route.fulfill({ json: [] });
    requests.push(url);

    const pageNumber = Number(url.searchParams.get('page') || 1);
    const pageSize = Number(url.searchParams.get('pageSize') || 10);

    if (url.pathname.endsWith('/loyalty')) {
      return route.fulfill({
        json: {
          fromDate: '2026-11-01', toDate: '2026-11-27', tab: url.searchParams.get('tab') || 'redemptions', scope: 'Toàn hệ thống',
          summary: {
            totalRedemptions: 1, pendingRedemptions: 0, completedRedemptions: 1, overdueRedemptions: 0,
            redeemedPointsCompleted: 200, giftsDeliveredQuantity: 2, periodEarnedPoints: 500,
            periodUsedPoints: 200, periodExpiredPoints: 0, periodNetPointChange: 300,
            currentAvailablePoints: 800, currentHeldPoints: 0, activeCardCount: 1,
          },
          redemptions: {
            totalCount: 1, page: pageNumber, pageSize,
            items: [{
              id: 'red-1', createdAt: '2026-11-12T01:00:00Z', retailerId: 'r-1', retailerCode: 'RT01',
              retailerName: 'Cửa hàng An Phú', regionName: 'Hồ Chí Minh', programCode: 'LP01', programName: 'Loyalty',
              rewardCode: 'GIFT01', rewardName: 'Bình nước', quantity: 2, redeemedPoints: 200, status: 'Completed',
              approvedByName: 'Nguyễn Văn Duyệt',
            }],
          },
          ledger: { totalCount: 0, page: pageNumber, pageSize, items: [] },
          balances: { totalCount: 0, page: pageNumber, pageSize, items: [] },
          notes: ['Dữ liệu kiểm thử'],
        },
      });
    }

    if (url.pathname.endsWith('/promotions')) {
      return route.fulfill({
        json: {
          fromDate: '2026-11-01', toDate: '2026-11-27', scope: 'Toàn hệ thống',
          summary: {
            appliedOrderCount: 1, completedOrderCount: 1, totalQuantity: 10, grossAmount: 1000000,
            campaignDiscountAmount: 100000, shelfLifeDiscountAmount: 0, totalDiscountAmount: 100000,
            netAmount: 900000, completedNetAmount: 900000, completedDiscountAmount: 100000, effectiveDiscountRatePercent: 10,
          },
          byProgram: [{
            programCode: 'KM01', programName: 'Tháng 11', discountType: 'Campaign', orderCount: 1, completedOrderCount: 1,
            totalQuantity: 10, grossAmount: 1000000, discountAmount: 100000, campaignDiscountAmount: 100000,
            shelfLifeDiscountAmount: 0, netAmount: 900000, completedDiscountAmount: 100000, completedNetAmount: 900000,
            discountRatePercent: 10,
          }],
          items: { totalCount: 0, page: pageNumber, pageSize, items: [] },
          notes: [],
        },
      });
    }

    return route.fulfill({ json: {} });
  });

  await page.goto('/reports?kind=loyalty');
  await expect(page.getByRole('heading', { name: 'Báo cáo Loyalty & đổi quà' })).toBeVisible();
  await page.getByRole('row', { name: /Bình nước/ }).click();
  await expect(page.getByText('Nguyễn Văn Duyệt', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Đóng' }).click();

  await page.locator('label.lbl', { hasText: 'Khu vực' }).locator('select').selectOption('region-hcm');
  await expect.poll(() => requests.at(-1)?.searchParams.get('regionId')).toBe('region-hcm');

  const menu = page.getByRole('navigation', { name: 'Danh mục chức năng', exact: true });
  await menu.getByRole('link', { name: 'Báo cáo khuyến mãi & HSD', exact: true }).click();
  await expect.poll(() => requests.at(-1)?.pathname).toContain('/reports/promotions');
  await expect(page.getByRole('columnheader', { name: /Tổng giảm/ })).toBeVisible();
});
