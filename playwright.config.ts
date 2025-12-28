import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// Подхватываем переменные из .env.local для e2e
dotenv.config({ path: '.env.local' });

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

const shouldStartServer = baseURL.includes('localhost');

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  timeout: 2 * 60 * 1000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: shouldStartServer
    ? {
        command: 'npm run dev',
        url: baseURL,
        timeout: 120 * 1000,
        reuseExistingServer: true,
      }
    : undefined,
});
