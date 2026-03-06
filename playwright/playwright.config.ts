/* eslint-disable import/no-extraneous-dependencies */
import {defineConfig, devices} from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import {USER_SETS} from './test-data';

dotenv.config({path: path.resolve(__dirname, '.env')});

const dummyAudioPath = path.resolve(__dirname, './wav/dummyAudio.wav');

export default defineConfig({
  testDir: '.',
  timeout: 180000,
  webServer: {
    command: 'yarn samples:serve',
    url: 'https://localhost:8000',
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
    ignoreHTTPSErrors: true,
  },
  retries: 0,
  fullyParallel: true,
  workers: Object.keys(USER_SETS).length,
  reporter: 'html',
  use: {
    baseURL: process.env.PW_BASE_URL || 'https://localhost:8000/samples/contact-center/',
    trace: 'retain-on-failure',
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'OAuth: Get Access Token',
      testMatch: /global\.setup\.ts/,
    },
    ...Object.entries(USER_SETS).map(([setName, setData], index) => ({
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
            '--disable-site-isolation-trials',
            '--disable-web-security',
            '--no-sandbox',
            '--disable-features=WebRtcHideLocalIpsWithMdns',
            '--allow-file-access-from-files',
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            `--use-file-for-fake-audio-capture=${dummyAudioPath}`,
            `--remote-debugging-port=${9221 + index}`,
            '--disable-extensions',
            '--disable-plugins',
            `--window-position=${index * 1300},0`,
            '--window-size=1280,720',
          ],
        },
      },
    })),
  ],
});
