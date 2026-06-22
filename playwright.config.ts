import { defineConfig, devices } from '@playwright/test';

// E2E config. Tests run against the dev server on :1013 (reused if already running, else
// started). Network calls hit the real Open-Meteo API, so assertions avoid pinning exact
// weather values and check structural/behavioural outcomes instead.
export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:1013',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:1013',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
