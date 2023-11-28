/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-disable require-jsdoc */
const debug = require('debug')('tooling:test');
const dotenv = require('dotenv');

dotenv.config();
dotenv.config({path: '.env.default'});

const {collect, combine} = require('../../util/coverage');
const {glob} = require('../../util/package');

const {gatherFiles} = require('./common');
const {test: mochaTest} = require('./mocha');
const {test: jestTest} = require('./jest');
const {test: karmaTest} = require('./karma');

/* eslint-disable complexity */

exports.testPackage = async function testPackage(options, packageName, onMocha) {
  // Move NODE_ENV override into the exported function since babel-node is processing everything above
  process.env.NODE_ENV = process.env.NODE_ENV || 'test';

  let currentPackageString = `===== Testing ${packageName} =====`;
  if(options.node || options.unit)
   currentPackageString = `===== Testing with ${onMocha ? 'Mocha' : 'Jest'} ${packageName} =====`;

  console.info(`\n${'='.repeat(currentPackageString.length)}`);
  console.info(currentPackageString);
  console.info(`${'='.repeat(currentPackageString.length)}\n`);

  if (options.node || options.unit) {
    await runNodeSuite(options, packageName, onMocha);
  }

  if (options.browser || options.integration) {
    await runBrowserSuite(options, packageName);
  }

  if (options.automation) {
    await runAutomationSuite(options, packageName);
  }

  if (options.coverage) {
    await collect(packageName);
    await combine(packageName);
  }
};

async function runNodeSuite(options, packageName, onMocha) {
  debug(`Running node suite for ${packageName}`);
  // gatherFiles obtaines absolute path of all files under unit test folder
  const files = await gatherFiles('unit', packageName);

  if (files.length === 0) {
    debug(`no files found for ${packageName}`);

    return;
  }

  /**
   * mochaTest is imported from lib/test/mocha
   * jestTest is imported from lib/test/jest
   * this method in turn creates mocha/jest object and run tests
   * temporarily we are running "plugin-meetings" and "webex" on mocha and all other
   * packages on jest and will migrate to complete jest once all test cases are fixed
   */
  if (onMocha) await mochaTest(options, packageName, 'node', files);
  else await jestTest(files);

  debug(`Finished node suite for ${packageName}`);
}

async function runBrowserSuite(options, packageName) {
  debug(`Running browser suite for ${packageName}`);
  const files = await gatherFiles('integration', packageName);

  if (files.length === 0) {
    debug(`no files found for ${packageName}`);

    return;
  }

  /**
   * karmaTest is imported from lib/test/karma
   * this method in turn creates karma server and run tests
   */
  await karmaTest(options, packageName, files);

  debug(`Finished browser suite for ${packageName}`);
}

async function runAutomationSuite(options, packageName) {
  debug(`Running automation suite for ${packageName}`);
  const files = (await glob('test/automation/spec/**/*.js', {packageName})).map(
    (f) => `packages/${packageName}/${f}`
  );

  if (files.length === 0) {
    debug(`no files found for ${packageName}`);

    return;
  }

  /**
   * mochaTest is imported from lib/test/mocha
   * this method in turn creates mocha object and run tests
   */
  await mochaTest(options, packageName, 'automation', files);

  debug(`Finished automation suite for ${packageName}`);
}
