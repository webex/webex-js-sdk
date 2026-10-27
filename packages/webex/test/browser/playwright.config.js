/*!
 * Copyright (c) 2026 Cisco Systems, Inc. See LICENSE file.
 */

const path = require('path');
const {createRequire} = require('module');

const requireRoot = createRequire(path.resolve(__dirname, '../../../../package.json'));
const {defineConfig} = requireRoot('@playwright/test');

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: 'assets-config.spec.js',
  outputDir: path.resolve(__dirname, '../../reports/browser-assets'),
  timeout: 120000,
  workers: 1,
  reporter: 'list',
  use: {
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
});
