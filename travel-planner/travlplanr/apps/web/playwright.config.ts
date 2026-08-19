import { defineConfig, devices } from '@playwright/test';

/**
 * E2E config for the customer app. Requires the full stack running locally
 * (`docker compose up -d` at the repo root, then `npm start` here) — these
 * specs hit real identity/planner endpoints via the dev proxy, not mocks.
 * Override the target with E2E_BASE_URL (e.g. a staging URL).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env['CI'] ? 1 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }]],
  timeout: 60_000,
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      animations: 'disabled',
    },
  },
  use: {
    baseURL: process.env['E2E_BASE_URL'] || 'http://localhost:4200',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
