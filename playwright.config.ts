import { defineConfig, devices } from '@playwright/test';

/**
 * Live smoke tests need a seeded backend and credentials supplied by the
 * caller. Keeping them in environment variables prevents test credentials
 * from becoming repository data.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173',
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        {
          command: 'dotnet run --project ../FSCM-Backend/src/FSCM.API --launch-profile https',
          url: 'https://localhost:7027',
          ignoreHTTPSErrors: true,
          reuseExistingServer: !process.env.CI || process.env.E2E_REUSE_SERVERS === 'true',
          timeout: 90_000,
        },
        {
          command: 'npm run dev -- --host 127.0.0.1',
          url: 'http://127.0.0.1:5173',
          reuseExistingServer: !process.env.CI || process.env.E2E_REUSE_SERVERS === 'true',
          timeout: 30_000,
        },
      ],
});
