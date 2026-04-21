const {defineConfig} = require('@playwright/test');

module.exports = defineConfig({
  testDir: '.',
  testMatch: 'validate-site-selection.spec.js',
  timeout: 120_000,
  use: {
    ignoreHTTPSErrors: true,
    headless: true,
    screenshot: 'on',
    video: 'on',
  },
  reporter: [['list']],
});
