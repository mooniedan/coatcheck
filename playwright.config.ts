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
  // Retry once locally too: the dev server compiles routes on first hit, so a cold parallel
  // run can transiently time out. Cap workers so we don't hammer the dev server at once.
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : 4,
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
