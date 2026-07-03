import {defineConfig, devices} from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import {USER_SETS} from './cc_playwright/test-data';

dotenv.config({path: path.resolve(__dirname, 'cc_playwright/.env')});

const dummyAudioPath = path.resolve(__dirname, './cc_playwright/wav/dummyAudio.wav');

export default defineConfig({
  testDir: './cc_playwright',
  timeout: 220000,
  webServer: {
    command: 'yarn samples:serve --port 8000',
    url: 'https://localhost:8000/samples/contact-center/',
    timeout: 180000,
    ignoreHTTPSErrors: true,
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
  },
  retries: 0,
  fullyParallel: true,
  workers: Object.keys(USER_SETS).length, // Dynamic worker count based on USER_SETS
  reporter: 'html',
  use: {
    baseURL: 'https://localhost:8000/samples/contact-center/',
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'OAuth: Get Access Token',
      testMatch: /global\.setup\.ts/,
    },
    // Dynamically generate test projects from USER_SETS
    ...Object.entries(USER_SETS).map(([setName, setData], index) => {
      return {
        name: setName,
        dependencies: ['OAuth: Get Access Token'],
        fullyParallel: false,
        retries: 1,
        testMatch: [`**/suites/${setData.TEST_SUITE}`],
        use: {
          ...devices['Desktop Chrome'],
          channel: 'chrome',
          storageState: undefined,
          launchOptions: {
            args: [
              `--disable-site-isolation-trials`,
              `--disable-web-security`,
              `--no-sandbox`,
              `--disable-features=WebRtcHideLocalIpsWithMdns`,
              `--allow-file-access-from-files`,
              `--use-fake-ui-for-media-stream`,
              `--use-fake-device-for-media-stream`,
              `--use-file-for-fake-audio-capture=${dummyAudioPath}`,
              `--remote-debugging-port=${9221 + index}`,
              `--disable-extensions`,
              `--disable-plugins`,
              `--window-position=${index * 1300},0`,
              `--window-size=1280,720`,
            ],
          },
        },
      };
    }),
  ],
});
