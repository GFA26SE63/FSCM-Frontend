import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', testMatch: ['inventory-promotions.spec.ts', 'table-layout.spec.ts'], workers: 1,
  use: { baseURL: 'http://127.0.0.1:5183', ...devices['Desktop Chrome'], channel: 'chrome', screenshot: 'only-on-failure' },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5183', url: 'http://127.0.0.1:5183', reuseExistingServer: true },
});
