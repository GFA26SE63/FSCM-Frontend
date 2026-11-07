import { expect, test } from '@playwright/test';

test('shared list and detail tables preserve a flexible column beside oversized fixed columns', async ({ page }) => {
  await page.goto('/tests/e2e/fixtures/table-layout.html');
  const tables = page.locator('table.tbl');
  await expect(tables).toHaveCount(2);
  for (const table of await tables.all()) {
    const name = table.locator('tbody tr').first().locator('td').nth(1);
    await expect(name).toContainText('Sữa tươi');
    expect((await name.boundingBox())!.width).toBeGreaterThanOrEqual(140);
    expect((await name.boundingBox())!.height).toBeLessThan(120);
  }
});

for (const width of [1024, 1366, 1536]) {
  test(`product names and table actions stay readable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => sessionStorage.setItem('fscm.portal.session.v1', JSON.stringify({
      id: 'layout-session', remember: false, accessToken: 'layout-token', accessTokenExpiresAt: '2099-01-01',
      refreshToken: 'layout-refresh', refreshTokenExpiresAt: '2099-01-01',
    })));
    await page.route('**/api/v1/**', async (route) => {
      const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
      const products = [{ id: 'p1', sku: 'SKU001', name: 'Sữa tươi tiệt trùng nguyên chất 1 lít',
        categoryName: 'Sữa và sản phẩm từ sữa', categoryCode: 'CAT-01', productCategoryId: 'c1', unit: 'Thùng',
        status: 'Published', currentUnitPrice: 252000, shelfLifeHours: 168, nearDateThresholdHours: 24 }];
      await route.fulfill({ json: path === '/auth/me' ? { id: 'admin', email: 'layout@example.test', fullName: 'Demo Admin', role: 'Admin' }
        : path === '/products' ? { items: products, totalCount: products.length, totalPages: 1 } : [] });
    });
    await page.goto('/skus');
    const table = page.locator('table.tbl').first();
    await expect(table.getByText('SKU001', { exact: true })).toBeVisible();
    const name = table.locator('tbody tr').first().locator('td').nth(1);
    expect((await name.boundingBox())!.width).toBeGreaterThanOrEqual(220);
    expect((await name.boundingBox())!.height).toBeLessThan(100);
    const header = table.getByRole('columnheader', { name: 'Tên sản phẩm', exact: true });
    expect((await header.boundingBox())!.width).toBeGreaterThanOrEqual(220);
    const wrapper = table.locator('..');
    await wrapper.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
    await expect(table.getByRole('button', { name: 'Tạo bản mới', exact: true })).toBeInViewport();
    await expect(table.getByRole('button', { name: 'Ngừng bán', exact: true })).toBeInViewport();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await wrapper.evaluate((el) => { el.scrollLeft = 0; });
    await page.screenshot({ path: `test-results/products-layout-${width}.png`, fullPage: true });
  });
}
