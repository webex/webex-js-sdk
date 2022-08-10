/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */
const debug = require('debug')('tooling:test:mocha');
const Mocha = require('mocha');

require('@babel/register')({
  only: [
    './packages/node_modules/**/*.js',
  ],
  sourceMaps: true
});

exports.test = async function test(options, packageName, suite, files) {
  debug(`testing ${files}`);

  options.output = `reports/junit/mocha/${packageName}-${suite}.xml`;

  return run(options, files)
    .catch(() => {
      debug(`${files} failed`);
      throw new Error('Mocha suite failed');
    });
};

/**
 * Runs test
 * @param {Object} options
 * @param {Array<string>} files
 * @returns {Promise<Number>}
 */
async function run(options, files) {
  const cfg = {
    diff: true,
    bail: options.bail,
    retries: (process.env.JENKINS || process.env.CIRCLECI || process.env.CI) ? 1 : 0,
    timeout: 30000,
    grep: new RegExp(options.grep.join('|'))
  };

  if (options.xunit || process.env.COVERAGE || process.env.CIRCLECI || process.env.CI) {
    cfg.reporter = 'packages/node_modules/@webex/xunit-with-logs';
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
