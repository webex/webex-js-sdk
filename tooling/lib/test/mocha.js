/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

const debug = require(`debug`)(`tooling:test:mocha`);
const Mocha = require(`mocha`);
const {expectReports, expectNonEmptyReports, expectNoKmsErrors} = require(`./common`);

exports.test = async function test(options, packageName, suite, files) {
  debug(`testing ${files}`);

  options.output = `reports/junit/mocha/${packageName}-${suite}.xml`;

  if (options.xunit) {
    for (let i = 0; i < 3; i++) {
      try {
        debug(`Attempt #${i} for ${packageName}`);

        await run(options, files);
        await expectReports([options.output]);
        await expectNonEmptyReports([options.output]);
        await expectNoKmsErrors([options.output]);
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
    const failures = await run(options, files);
    if (failures) {
      debug(`${files} failed`);
      throw new Error(`Mocha suite failed`);
    }
    else {
      debug(`${files} succeeded`);
    }
  }
  return;
};

/**
 * Runs test
 * @param {Object} options
 * @param {Array<string>} files
 * @returns {Promise<Number>}
 */
async function run(options, files) {
  const cfg = {
    retries: process.env.JENKINS || process.env.CI ? 1 : 0,
    timeout: 30000,
    grep: new RegExp(options.grep.join(`|`))
  };

  if (options.xunit) {
    cfg.reporter = `packages/node_modules/@ciscospark/xunit-with-logs`;
    cfg.reporterOptions = {
      output: options.output
    };
  }

  const mocha = new Mocha(cfg);
  files.forEach((f) => mocha.addFile(f));
  return new Promise((resolve) => {
    mocha.run(resolve);
  });
}
