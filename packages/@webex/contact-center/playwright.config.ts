import {defineConfig, devices} from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import {USER_SETS} from './test/e2e/playwright/test-data';

dotenv.config({path: path.resolve(__dirname, './test/e2e/.env.contact-center.e2e')});

const dummyAudioPath = path.resolve(__dirname, './test/e2e/playwright/wav/dummyAudio.wav');

/**
 * Playwright configuration for the Contact Center E2E suites.
 * Each USER_SET in test-data.ts becomes its own project so we can parallelize the
 * multi-agent scenarios without clashing credentials.
 */
export default defineConfig({
  testDir: './test/e2e/playwright/suites',
  outputDir: './test/e2e/test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: Object.keys(USER_SETS).length || 1,
  timeout: 3 * 60 * 1000,
  expect: {
    timeout: 10 * 1000,
  },
  reporter: [
    [
      'html',
      {
        outputFolder: './test/e2e/playwright-report',
        open: process.env.CI ? 'never' : 'on-failure',
      },
    ],
    [
      'junit',
      {
        outputFile: './test/e2e/junit.xml',
      },
    ],
    ['list'],
  ],
  use: {
    baseURL: 'https://localhost:8000',
    trace: process.env.CI ? 'on-first-retry' : 'retain-on-failure',
    video: process.env.CI ? 'retain-on-failure' : 'on',
    screenshot: 'only-on-failure',
    viewport: {width: 1280, height: 720},
    ignoreHTTPSErrors: true,
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--allow-insecure-localhost',
      ],
    },
  },
  projects: [
    {
      name: 'OAuth: Get Access Token',
      testDir: './test/e2e/playwright',
      testMatch: /global\.setup\.ts/,
    },
    ...Object.entries(USER_SETS).map(([setName, setData], index) => ({
      name: setName,
      testMatch: [`**/suites/${setData.TEST_SUITE}`],
      dependencies: ['OAuth: Get Access Token'],
      retries: process.env.CI ? 1 : 0,
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        baseURL: 'https://localhost:8000',
        launchOptions: {
          args: [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            '--allow-insecure-localhost',
            `--use-file-for-fake-audio-capture=${dummyAudioPath}`,
            `--remote-debugging-port=${9221 + index}`,
            '--disable-site-isolation-trials',
            '--disable-web-security',
            '--no-sandbox',
            '--disable-features=WebRtcHideLocalIpsWithMdns',
            '--allow-file-access-from-files',
            `--window-position=${index * 1400},0`,
            '--window-size=1280,720',
          ],
        },
      },
    })),
  ],
  webServer: {
    command: 'cd ../../.. && npx webpack serve --color --env NODE_ENV=development --host localhost',
    port: 8000,
    reuseExistingServer: !process.env.CI,
    timeout: 2 * 60 * 1000,
  },
});
