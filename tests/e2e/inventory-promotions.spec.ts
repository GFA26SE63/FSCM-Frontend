import { expect, test, type Page } from '@playwright/test';

const products = [
  { id: 'p1', sku: 'SKU001', name: 'Sữa tươi 1 lít', status: 'Published' },
  { id: 'p2', sku: 'SKU002', name: 'Sữa chua uống 180 ml', status: 'Published' },
];
const promo = { id: 'km1', code: 'KM-005', name: 'Demo đã lưu', minimumQuantity: 10, discountPercent: 8,
  startAt: '2026-01-01', endAt: '2099-01-01', isActive: false, productIds: ['p1'], categoryIds: [], retailerIds: [], promotionType: 'Campaign' };

async function setup(page: Page) {
  let currentPromo = { ...promo };
  let published: unknown;
  await page.addInitScript(() => sessionStorage.setItem('fscm.portal.session.v1', JSON.stringify({
    id: 'test-session', remember: false, accessToken: 'test-token', accessTokenExpiresAt: '2099-01-01T00:00:00Z',
    refreshToken: 'test-refresh', refreshTokenExpiresAt: '2099-01-01T00:00:00Z',
  })));
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace('/api/v1', '');
    const method = route.request().method();
    let body: unknown = [];
    if (path === '/auth/me') body = { id: 'admin', email: 'demo@example.test', fullName: 'Demo Admin', role: 'Admin' };
    else if (path === '/products') body = { items: products, totalCount: 2 };
    else if (path === '/categories') body = [{ id: 'cat1', code: 'CAT-01', name: 'Sữa' }];
    else if (path === '/retailers') body = { items: [], totalCount: 0 };
    else if (path === '/warehouses') body = [{ id: 'wh1', code: 'WH-TD', name: 'Kho Thủ Đức', status: 'Active' }];
    else if (path === '/promotions' && method === 'GET') {
      // Reproduce the server default that hides drafts and paused campaigns.
      body = url.searchParams.get('includeInactive') === 'true' || currentPromo.isActive ? [currentPromo] : [];
    } else if (path === '/promotions' && method === 'POST') {
      currentPromo = { ...currentPromo, ...route.request().postDataJSON(), isActive: false }; body = currentPromo;
    } else if (path === '/promotions/km1/activate') { currentPromo.isActive = true; body = currentPromo; }
    else if (path === '/promotions/km1/deactivate') { currentPromo.isActive = false; body = currentPromo; }
    else if (path === '/promotions/km1') body = currentPromo;
    else if (path === '/shelf-life-discounts/current') body = { id: 'table1', version: 1, effectiveFrom: '2026-01-01', tiers: [] };
    else if (path === '/shelf-life-discounts' && method === 'POST') { published = route.request().postDataJSON(); body = { version: 2 }; }
    await route.fulfill({ json: body });
  });
  return { published: () => published };
}

test('saved drafts remain listed, and activating then pausing does not remove the row', async ({ page }) => {
  await setup(page);
  await page.goto('/promos');
  await expect(page.getByText('Demo đã lưu', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Kích hoạt', exact: true }).click();
  await page.getByRole('button', { name: 'Tạm dừng', exact: true }).click();
  await expect(page.getByText('Demo đã lưu', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Kích hoạt', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Demo đã lưu', { exact: true })).toBeVisible();
});

test('create promotion searches code/name, keeps selection across searches and saves a visible draft', async ({ page }) => {
  await setup(page);
  await page.goto('/promos/new');
  await page.getByLabel('Tên chương trình').fill('Demo mới lưu');
  await page.getByLabel('Mua tối thiểu (thùng)').fill('10');
  await page.getByLabel('% giảm').fill('8');
  const search = page.getByPlaceholder('Nhập mã SKU hoặc tên sản phẩm…');
  await search.fill('sua tuoi');
  await page.getByLabel('SKU001 · Sữa tươi 1 lít').check();
  await search.fill('SKU002');
  await expect(page.getByLabel('SKU002 · Sữa chua uống 180 ml')).toBeVisible();
  await search.fill('');
  await expect(page.getByLabel('SKU001 · Sữa tươi 1 lít')).toBeChecked();
  await page.getByRole('button', { name: 'Tạo khuyến mãi', exact: true }).click();
  await expect(page).toHaveURL(/\/promos\/km1$/);
  await expect(page.getByText(/Chương trình đã được lưu/)).toBeVisible();
  await page.goto('/promos');
  await expect(page.getByText('Demo mới lưu', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/promotions-paused.png', fullPage: true });
});

test('receiving product picker searches unaccented name or code and supports keyboard selection', async ({ page }) => {
  await setup(page);
  await page.goto('/receipts/new');
  const input = page.getByRole('combobox').last();
  await input.fill('sua tuoi');
  await expect(page.getByRole('option', { name: 'SKU001 · Sữa tươi 1 lít' })).toBeVisible();
  await input.press('Enter');
  await expect(input).toHaveValue('SKU001 · Sữa tươi 1 lít');
  await input.fill('SKU002');
  await input.press('Enter');
  await expect(input).toHaveValue('SKU002 · Sữa chua uống 180 ml');
  await input.fill('unknown-product');
  await expect(page.getByText('Không tìm thấy kết quả.')).toBeVisible();
  await input.press('Tab');
  await expect(input).toHaveValue('');
  await input.click();
  await page.getByRole('option', { name: 'SKU001 · Sữa tươi 1 lít' }).click();
  await expect(input).toHaveValue('SKU001 · Sữa tươi 1 lít');
});

test('shelf-life editor selects a product by name and submits its identifier without JSON editing', async ({ page }) => {
  const state = await setup(page);
  await page.goto('/batchpromo');
  await page.getByRole('button', { name: 'Publish phiên bản mới' }).click();
  // The searchable product control is an input; the other comboboxes are native selects.
  const product = page.locator('input[role="combobox"]');
  await product.fill('SKU002');
  await product.press('Enter');
  await page.screenshot({ path: 'test-results/shelf-life-editor.png', fullPage: true });
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect.poll(() => state.published()).toMatchObject({ tiers: [{ scope: 'Sku', productId: 'p2', discountValue: 10 }] });
  await expect(page.getByRole('dialog')).not.toBeVisible();
});
