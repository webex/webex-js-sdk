/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-disable require-jsdoc */
const debug = require('debug')('tooling:test');
const dotenv = require('dotenv');

dotenv.config();
dotenv.config({path: '.env.default'});

const {
  collect,
  combine
} = require('../../util/coverage');
const {glob} = require('../../util/package');

const {
  gatherFiles
} = require('./common');
const {test: mochaTest} = require('./mocha');
const {test: karmaTest} = require('./karma');

/* eslint-disable complexity */

exports.testPackage = async function testPackage(options, packageName) {
  // Move NODE_ENV override into the exported function since babel-node is processing everything above
  process.env.NODE_ENV = process.env.NODE_ENV || 'test';

  const currentPackageString = `===== Testing ${packageName} =====`;

  console.info(`\n${'='.repeat(currentPackageString.length)}`);
  console.info(currentPackageString);
  console.info(`${'='.repeat(currentPackageString.length)}\n`);

  if (options.node || options.unit) {
    await runNodeSuite(options, packageName);
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

async function runNodeSuite(options, packageName) {
  debug(`Running node suite for ${packageName}`);
  const files = await gatherFiles('unit', packageName);

  if (files.length === 0) {
    debug(`no files found for ${packageName}`);

    return;
  }


  await mochaTest(options, packageName, 'node', files);

  debug(`Finished node suite for ${packageName}`);
}

async function runBrowserSuite(options, packageName) {
  debug(`Running browser suite for ${packageName}`);
  const files = await gatherFiles('integration', packageName);

  if (files.length === 0) {
    debug(`no files found for ${packageName}`);

    return;
  }

  await karmaTest(options, packageName, files);

  debug(`Finished browser suite for ${packageName}`);
}

async function runAutomationSuite(options, packageName) {
  debug(`Running automation suite for ${packageName}`);
  const files = (await glob('test/automation/spec/**/*.js', {packageName}))
    .map((f) => `packages/node_modules/${packageName}/${f}`);

  if (files.length === 0) {
    debug(`no files found for ${packageName}`);

    return;
  }

  await mochaTest(options, packageName, 'automation', files);

  debug(`Finished automation suite for ${packageName}`);
}
