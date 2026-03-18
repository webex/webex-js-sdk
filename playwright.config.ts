import {defineConfig, devices} from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

import {BASE_URL} from './playwright/constants';

dotenv.config({path: path.resolve(__dirname, '.env')});

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
      name: 'OAuth: Get Access Token',
      testMatch: /global\.setup\.ts/,
    },
    {
      name: 'Calling SDK E2E',
      dependencies: ['OAuth: Get Access Token'],
      testMatch: ['**/tests/**/*.spec.ts'],
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
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
          ],
        },
      },
    },
  ],
});
