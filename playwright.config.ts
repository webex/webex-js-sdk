import {defineConfig, devices} from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({path: path.resolve(__dirname, '.env')});

const BASE_URL = process.env.PW_BASE_URL || 'https://localhost:8000';

const chromeOptions = {
  ...devices['Desktop Chrome'],
  channel: 'chrome' as const,
  launchOptions: {
    args: [
      '--disable-site-isolation-trials',
      '--disable-web-security',
      '--no-sandbox',
      '--disable-features=WebRtcHideLocalIpsWithMdns',
      '--allow-file-access-from-files',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--disable-extensions',
      '--disable-plugins',
      '--ignore-certificate-errors',
    ],
  },
};

export default defineConfig({
  testDir: './playwright',
  timeout: 120000,
  webServer: {
    command: 'yarn samples:serve',
    url: BASE_URL,
    ignoreHTTPSErrors: true,
    reuseExistingServer: true,
    stdout: 'ignore',
    stderr: 'pipe',
  },
  retries: 0,
  fullyParallel: false,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'Calling: OAuth Setup',
      testDir: './playwright/tests/calling',
      testMatch: /global\.setup\.ts/,
    },
    {
      name: 'Calling SDK E2E',
      dependencies: ['Calling: OAuth Setup'],
      testDir: './playwright/tests/calling',
      use: chromeOptions,
    },
    {
      name: 'Contact Center SDK E2E',
      testDir: './playwright/tests/contact-center',
      use: chromeOptions,
    },
  ],
});
