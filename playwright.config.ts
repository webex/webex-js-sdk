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
      '--disable-site-isolation-trials', // Allow cross-origin iframes in the same process
      '--disable-web-security', // Bypass CORS for local dev server
      '--no-sandbox', // Required for CI containers without root
      '--disable-features=WebRtcHideLocalIpsWithMdns', // Expose real local IPs for WebRTC ICE candidates
      '--allow-file-access-from-files', // Allow file:// protocol access
      '--use-fake-ui-for-media-stream', // Auto-grant camera/mic permissions without prompt
      '--use-fake-device-for-media-stream', // Use synthetic audio/video instead of real hardware
      '--disable-extensions', // Prevent extensions from interfering with tests
      '--disable-plugins', // Prevent plugins from interfering with tests
      '--ignore-certificate-errors', // Accept self-signed certs from local dev server
      ...(process.env.CI ? [] : ['--auto-open-devtools-for-tabs']), // Open DevTools only in local runs
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
  retries: 3,
  fullyParallel: false,
  workers: 3,
  reporter: 'html',
  use: {
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'Calling: OAuth Setup',
      testDir: './playwright/calling/utils',
      testMatch: /oauth\.setup\.ts/,
    },
    {
      name: 'Calling SDK E2E',
      dependencies: ['Calling: OAuth Setup'],
      testDir: './playwright/calling/tests',
      use: chromeOptions,
    },
    // TODO: Uncomment when Contact Center tests are added
    // {
    //   name: 'Contact Center SDK E2E',
    //   testDir: './playwright/contact-center',
    //   use: chromeOptions,
    // },
  ],
});
