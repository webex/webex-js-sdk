import {defineConfig, devices} from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import {USER_SETS} from './playwright/test-data';

// .env lives at repo root
dotenv.config({path: path.resolve(__dirname, '../../.env')});

const BASE_URL = process.env.PW_BASE_URL || 'https://localhost:8000';

// Browser selection via PW_BROWSER env var: 'chrome' (default), 'firefox', 'edge', 'safari'
const PW_BROWSER = process.env.PW_BROWSER || 'chrome';

const chromiumArgs = [
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
];

const browserOptions: Record<string, object> = {
  chrome: {
    ...devices['Desktop Chrome'],
    channel: 'chrome' as const,
    launchOptions: {args: chromiumArgs},
  },
  edge: {
    ...devices['Desktop Edge'],
    channel: 'msedge' as const,
    launchOptions: {args: chromiumArgs},
  },
  firefox: {
    ...devices['Desktop Firefox'],
    launchOptions: {
      firefoxUserPrefs: {
        'media.navigator.streams.fake': true, // Use fake media devices
        'media.navigator.permission.disabled': true, // Auto-grant media permissions
      },
    },
  },
  safari: {
    ...devices['Desktop Safari'],
  },
};

export default defineConfig({
  testDir: './playwright',
  timeout: 120000,
  webServer: {
    command: 'yarn samples:serve',
    cwd: path.resolve(__dirname, '../..'),
    url: BASE_URL,
    ignoreHTTPSErrors: true,
    reuseExistingServer: true,
    stdout: 'ignore',
    stderr: 'pipe',
  },
  retries: 3,
  fullyParallel: false,
  workers: 10,
  reporter: 'html',
  use: {
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
  },
  projects: [
    // OAuth (structurally different — not generated from USER_SETS)
    {
      name: 'OAuth - PROD',
      testDir: './playwright/utils',
      testMatch: /oauth\.setup\.ts/,
    },
    {
      name: 'OAuth - INT',
      testDir: './playwright/utils',
      testMatch: /oauth\.setup\.ts/,
      use: {testEnv: 'int'} as any,
    },

    // Generated from USER_SETS — prod + INT mirror for each set
    ...Object.entries(USER_SETS).flatMap(([key, set]) => [
      {
        name: `${key} - PROD`,
        dependencies: ['OAuth - PROD'],
        testDir: './playwright/suites',
        testMatch: set.testSuite,
        use: browserOptions[PW_BROWSER],
      },
      {
        name: `${key} - INT`,
        dependencies: ['OAuth - INT'],
        testDir: './playwright/suites',
        testMatch: set.testSuite,
        use: {...browserOptions[PW_BROWSER], testEnv: 'int'} as any,
      },
    ]),
  ],
});
