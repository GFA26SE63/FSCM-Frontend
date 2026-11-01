import { expect, test } from '@playwright/test';

test.describe('authentication', () => {
  test('shows the demo login form', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByText('FSCM Portal', { exact: true })).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: 'Vai trò demo' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Admin' })).toBeChecked();
    await expect(page.getByLabel('Email')).toHaveValue('khoa.pm@fscm.local');
    await expect(page.getByRole('button', { name: 'Đăng nhập demo' })).toBeVisible();
  });

  test('redirects anonymous users to login', async ({ page }) => {
    await page.goto('/orders');

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('button', { name: 'Đăng nhập demo' })).toBeVisible();
  });

  test('logs an admin into the orders workspace', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Đăng nhập demo' }).click();

    await expect(page).toHaveURL(/\/orders$/);
    await expect(page.locator('.topbar-title')).toHaveText('Đơn hàng');
  });
});
