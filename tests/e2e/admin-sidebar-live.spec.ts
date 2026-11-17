import { expect, test, type Page } from '@playwright/test';

const credentials = {
  email: process.env.E2E_ADMIN_EMAIL,
  password: process.env.E2E_ADMIN_PASSWORD,
};

const sidebarGroups = [
  {
    name: 'Bán hàng & Tài chính',
    routes: ['/orders', '/allocation', '/debts', '/refunds', '/complaints'],
  },
  {
    name: 'Danh mục',
    routes: ['/regions', '/cats', '/catmlor', '/skus', '/whs'],
  },
  {
    name: 'Hệ thống',
    routes: ['/users', '/config'],
  },
] as const;

function requireLiveCredentials() {
  test.skip(!credentials.email || !credentials.password,
    'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run against the development database.');
}

async function login(page: Page) {
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill(credentials.email!);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(credentials.password!);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20_000 });
  await expect(page.getByText('Quản trị viên', { exact: true })).toBeVisible();
}

function observeApplicationFailures(page: Page) {
  const failures: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') failures.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`));
  page.on('response', (response) => {
    const url = response.url();
    if ((url.includes('/api/') || url.includes('/graphql')) && response.status() >= 400) {
      failures.push(`HTTP ${response.status()}: ${url}`);
    }
  });
  return failures;
}

test.describe('Admin sidebar live smoke', () => {
  test.beforeEach(async ({ page }) => {
    requireLiveCredentials();
    await login(page);
  });

  for (const group of sidebarGroups) {
    test(`${group.name}: all sidebar links load without application errors`, async ({ page }) => {
      const failures = observeApplicationFailures(page);
      const groupButton = page.getByRole('button', { name: group.name, exact: true });
      await groupButton.click();
      await expect(groupButton).toHaveAttribute('aria-expanded', 'true');

      for (const route of group.routes) {
        await page.goto(route);
        await expect(page).toHaveURL(new RegExp(`${route.replace('/', '\\/')}(?:[?#]|$)`));
        await expect(page.locator('main, .page').first()).toBeVisible({ timeout: 20_000 });
        await expect(page.locator('[role="alert"], .callout-danger')).toHaveCount(0);
      }

      expect(failures, failures.join('\n')).toEqual([]);
    });
  }

  test('visible placeholders are reported as possible missing UI data', async ({ page }) => {
    const findings: string[] = [];
    for (const group of sidebarGroups) {
      for (const route of group.routes) {
        await page.goto(route);
        await expect(page.locator('main, .page').first()).toBeVisible({ timeout: 20_000 });
        const placeholders = await page.getByText('--', { exact: true }).allTextContents();
        if (placeholders.length) findings.push(`${route}: ${placeholders.length} placeholder(s)`);
      }
    }

    // Strict mode is deliberately opt-in until every nullable business field has
    // an explicit field-level contract. The report still exposes all candidates.
    test.info().annotations.push({ type: 'placeholder-audit', description: findings.join('; ') || 'none' });
    if (process.env.E2E_STRICT_PLACEHOLDERS === 'true') {
      expect(findings, `UI placeholders found:\n${findings.join('\n')}`).toEqual([]);
    }
  });
});
