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

    // Single-user registration sets (generated from USER_SETS, depend on OAuth)
    ...['SET_REGISTRATION_1', 'SET_REGISTRATION_2', 'SET_REGISTRATION_3', 'SET_CONTACTS'].flatMap(
      (key) => [
        {
          name: `${key} - PROD`,
          dependencies: ['OAuth - PROD'],
          testDir: './playwright/suites',
          testMatch: USER_SETS[key].testSuite,
          use: browserOptions[PW_BROWSER],
        },
        {
          name: `${key} - INT`,
          dependencies: ['OAuth - INT'],
          testDir: './playwright/suites',
          testMatch: USER_SETS[key].testSuite,
          use: {...browserOptions[PW_BROWSER], testEnv: 'int'} as any,
        },
      ]
    ),

    // 2-user call tests (PROD uses USER_4+USER_5, parallel with registration sets)
    {
      name: 'SET_CALL - PROD',
      dependencies: ['OAuth - PROD'],
      testDir: './playwright/suites',
      testMatch: USER_SETS.SET_CALL.testSuite,
      use: browserOptions[PW_BROWSER],
    },
    // INT call accounts are aliases for the registration accounts, so calls wait for registration
    {
      name: 'SET_CALL - INT',
      dependencies: [
        'SET_REGISTRATION_1 - INT',
        'SET_REGISTRATION_2 - INT',
        'SET_REGISTRATION_3 - INT',
      ],
      testDir: './playwright/suites',
      testMatch: USER_SETS.SET_CALL.testSuite,
      use: {...browserOptions[PW_BROWSER], testEnv: 'int'} as any,
    },
    // Call History has its own suite and can run in parallel with SET_CALL - PROD
    // because it uses USER_1+USER_2 after those single-user suites complete.
    {
      name: 'SET_CALL_HISTORY - PROD',
      dependencies: ['SET_REGISTRATION_1 - PROD', 'SET_REGISTRATION_2 - PROD'],
      testDir: './playwright/suites',
      testMatch: USER_SETS.SET_CALL_HISTORY.testSuite,
      use: browserOptions[PW_BROWSER],
    },
    // INT aliases overlap between USER_1/2 and USER_4/5, so keep INT ordered.
    {
      name: 'SET_CALL_HISTORY - INT',
      dependencies: ['SET_CALL - INT'],
      testDir: './playwright/suites',
      testMatch: USER_SETS.SET_CALL_HISTORY.testSuite,
      use: {...browserOptions[PW_BROWSER], testEnv: 'int'} as any,
    },

    // 3-user transfer tests — waits for call history because both suites use USER_1/USER_2.
    {
      name: 'SET_CALL_TRANSFER_CONSULT - PROD',
      dependencies: ['SET_CALL - PROD', 'SET_CALL_HISTORY - PROD'],
      testDir: './playwright/suites',
      testMatch: USER_SETS.SET_CALL_TRANSFER_CONSULT.testSuite,
      use: browserOptions[PW_BROWSER],
    },
    {
      name: 'SET_CALL_TRANSFER_CONSULT - INT',
      dependencies: ['SET_CALL - INT', 'SET_CALL_HISTORY - INT'],
      testDir: './playwright/suites',
      testMatch: USER_SETS.SET_CALL_TRANSFER_CONSULT.testSuite,
      use: {...browserOptions[PW_BROWSER], testEnv: 'int'} as any,
    },
    // Single-user Call Settings tests — shares USER_1/2/3 with registration and transfer
    {
      name: 'SET_CALL_SETTINGS - PROD',
      // Depends on SET_CALL so USER_4 (the CF forward destination) is deregistered
      // before the CF tests run, preventing forwarded calls from ringing a live
      // device in another suite. The dependency is explicit (not just transitive
      // via SET_CALL_TRANSFER_CONSULT) so the ordering survives future refactors.
      dependencies: [
        'OAuth - PROD',
        'SET_REGISTRATION_1 - PROD',
        'SET_REGISTRATION_2 - PROD',
        'SET_REGISTRATION_3 - PROD',
        'SET_CALL - PROD',
        'SET_CALL_TRANSFER_CONSULT - PROD',
      ],
      testDir: './playwright/suites',
      testMatch: USER_SETS.SET_CALL_SETTINGS.testSuite,
      use: browserOptions[PW_BROWSER],
    },
    {
      name: 'SET_CALL_SETTINGS - INT',
      // See PROD note above: explicit SET_CALL dependency guarantees USER_4 is
      // deregistered before the CF tests forward calls to it.
      dependencies: [
        'OAuth - INT',
        'SET_REGISTRATION_1 - INT',
        'SET_REGISTRATION_2 - INT',
        'SET_REGISTRATION_3 - INT',
        'SET_CALL - INT',
        'SET_CALL_TRANSFER_CONSULT - INT',
      ],
      testDir: './playwright/suites',
      testMatch: USER_SETS.SET_CALL_SETTINGS.testSuite,
      use: {...browserOptions[PW_BROWSER], testEnv: 'int'} as any,
    },
  ],
});
