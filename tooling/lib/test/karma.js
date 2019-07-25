/*!
 * Copyright (c) 2015-2019 Cisco Systems, Inc. See LICENSE file.
 */

const debug = require('debug')('tooling:test:karma');
const {Server} = require('karma');

const {makeConfig} = require('../../../karma-ng.conf');
const {glob} = require('../async');
const {inject} = require('../openh264');

const {expectNonEmptyReports, expectNoKmsErrors} = require('./common');

/* eslint-disable no-console */

// Splitting this function to reduce complexity would not aid in readability
// eslint-disable-next-line complexity
exports.test = async function test(options, packageName, files) {
  debug(`testing ${files}`);

  const cfg = makeConfig(packageName, options);

  if (packageName === '@webex/plugin-phone' || packageName === '@webex/media-engine-webrtc') {
    await inject(cfg.customLaunchers);
  }

  if (options.xunit || process.env.COVERAGE || process.env.CIRCLECI || process.env.CI) {
    for (let i = 0; i < 3; i += 1) {
      try {
        debug(`Attempt #${i} for ${packageName}`);

        await run(cfg, files);
        const reports = await glob(`./reports/junit/karma/*/${packageName}.xml`);

        if (reports.length !== cfg.browsers.length) {
          throw new Error(`Ran tests in ${cfg.browsers.length} browsers but only found ${reports.length} reports`);
        }
        await expectNonEmptyReports(reports);
        await expectNoKmsErrors(reports);
        debug(`Attempt #${i} for ${packageName} completed successfully`);
        break;
      }
      catch (err) {
        debug(err.message);
        if (i === 2) {
          throw err;
        }
      }
    }
  }
  else {
    const success = await run(cfg, files);

    if (success) {
      debug(`${files} succeeded`);
    }
    else {
      debug(`${files} failed`);
      throw new Error('Karma suite failed');
    }
  }
};

/**
 * Runs karma with the specified config
 * @param {Object} cfg
 * @returns {boolean}
 */
async function run(cfg) {
  const result = await new Promise((resolve) => {
    const server = new Server(cfg, (code) => resolve(code));

    server.on('browser_error', debugBrowserError);
    server.start(cfg);
  });

  return result === 0;
}

/**
 * Debug browser errors to quickly discern IE11 errors.
 * @see http://karma-runner.github.io/3.0/dev/public-api.html
 * @param {Object} browser The browser instance
 * @param {Object} error The error that occurred
 */
function debugBrowserError(browser, error) {
  let errorType = 'error';

  if (error.message) {
    errorType = error.message.split('\n')[0].toLowerCase();
  }
  const browserName = browser.name.toLowerCase();

  debug(`${errorType} on ${browserName}`);
}
