/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

const debug = require('debug')('tooling:test:karma');
const {Server, stopper} = require('karma');
const {readFile} = require('fs-promise');
const ps = require('ps-node');

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

  if (packageName === '@ciscospark/plugin-phone' ||
  packageName === '@ciscospark/media-engine-webrtc' ||
  packageName === '@webex/plugin-meetings') {
    await inject(cfg.customLaunchers);
  }

  if (options.xunit) {
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

    if (process.env.SC_TUNNEL_IDENTIFIER) {
      watchSauce(server, cfg);
    }

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

/**
 * Makes sure sauce stays running for the duration of the test suite
 * @param {Server} server
 * @param {Object} cfg
 */
async function watchSauce(server, cfg) {
  try {
    debug('reading sauce pid');
    const pid = parseInt(await readFile(process.env.SC_PID_FILE), 10);

    debug(`sauce pid is ${pid}`);

    let done = false;

    server.once('run_complete', () => {
      debug('run complete');
      done = true;
    });

    const delay = 1000;

    // eslint-disable-next-line no-unmodified-loop-condition
    while (!done) {
      debug(`waiting ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      debug(`waited ${delay}ms`);
      await new Promise((resolve, reject) => {
        debug(`checking if ${pid} is running`);
        ps.lookup({
          psargs: '-A',
          pid
        }, (err, resultList) => {
          if (err) {
            debug('ps-node produced an error', err);
            reject(err);

            return;
          }

          if (resultList.length === 0) {
            debug(`pid ${pid} is not running`);
            reject(new Error(`pid ${pid} is not running`));

            return;
          }

          debug(`pid ${pid} is running`);
          resolve();
        });
      });
    }
  }
  catch (err) {
    console.error(err);
    console.error('Sauce Tunnel is not running, stopping server and exiting');
    stopper.stop(cfg);
    // so, this is a bit harsh, but due to karma's api,there's no great way to
    // communicate back to test.js that karma failed because the tunnel
    // disappeared. By exiting here, cmd.sh should restart sauce and run the
    // suite again
    //  eslint-disable-next-line no-process-exit
    process.exit(65);
  }
}
