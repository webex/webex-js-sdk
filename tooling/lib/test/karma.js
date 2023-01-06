/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

const debug = require('debug')('tooling:test:karma');
const {
  Server,
  config: {parseConfig},
} = require('karma');

const {makeConfig} = require('../../../karma-ng.conf');

/**
 * Runs karma with the specified config
 * @param {Object} karmaConfig
 * @returns {boolean}
 */
const run = (karmaConfig) =>
  parseConfig(null, karmaConfig, {
    promiseConfig: true,
    throwErrors: true,
  }).then(
    async (config) => {
      const result = await new Promise((resolve) => {
        const server = new Server(config, (exitCode) => resolve(exitCode));

        server.on('browser_error', debugBrowserError);
        server.start();
      });

      return result === 0;
    },
    (err) => {
      throw new Error(err);
    }
  );

// Splitting this function to reduce complexity would not aid in readability
// eslint-disable-next-line complexity
exports.test = async function test(options, packageName, files) {
  debug(`testing ${files}`);

  const karmaConfig = makeConfig(packageName, options);

  return run(karmaConfig).catch(() => {
    debug(`${files} failed`);
    throw new Error('Karma suite failed');
  });
};

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
