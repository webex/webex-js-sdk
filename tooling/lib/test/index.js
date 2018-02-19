/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-disable require-jsdoc */
const debug = require('debug')('tooling:test');

const dotenv = require('dotenv');

dotenv.config();
dotenv.config({path: '.env.default'});
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const {
  gatherFiles
} = require('./common');
const mochaTest = require('./mocha').test;
const karmaTest = require('./karma').test;
const path = require('path');
const {
  collect,
  combine,
  deinstrument,
  instrument
} = require('../../util/coverage');
const {glob} = require('../../util/package');

/* eslint-disable complexity */

exports.testPackage = async function testPackage(options, packageName) {
  // eslint-disable-next-line global-require
  require('babel-register')({
    only: [
      './packages/node_modules/**/*.js'
    ],
    plugins: [
      path.resolve(__dirname, '../../babel-plugin-inject-package-version')
    ],
    sourceMaps: true
  });

  debug(`testing ${packageName}`);
  if (packageName === 'generator-ciscospark') {
    await runNodeSuite(packageName);
    return;
  }

  if (options.node) {
    if (options.coverage) {
      await instrument(packageName);
    }
    try {
      await runNodeSuite(options, packageName);
    }
    finally {
      if (options.coverage) {
        await deinstrument(packageName);
      }
    }
  }

  if (options.browser) {
    await runBrowserSuite(options, packageName);
  }

  if (options.automation) {
    await runAutomationSuite(options, packageName);
  }

  // Note: running docs test last because the babel transform interferes with
  // other test suites' test code. We should probably look at how to unload the
  // jsdoctrine transform once the doc tests complete.
  if (options.documentation) {
    await runDocsSuite(options, packageName);
  }

  if (options.coverage) {
    await collect(packageName);
    await combine(packageName);
  }
};


/**
 * Removes the specified files from the require cache. If we run mocha then docs
 * tests, the docs tests don't have a chance to load and transform the comments;
 * similarly, if we run docs then mocha, the mocha tests see the docs-
 * transformed code.
 * @param {Array<string>} files
 * @param {string} packageName
 * @private
 */
function uncache(files, packageName) {
  debug('removing files under test from require cache');
  const paths = files.map((f) => path.resolve('packages', 'node_modules', packageName, f));

  paths.forEach((fullPath) => {
    Reflect.deleteProperty(require.cache, fullPath);
  });
  debug('removed files under test from require cache');
}

async function runDocsSuite(options, packageName) {
  debug(`Running documentation tests for ${packageName}`);
  const files = await glob('dist/**/*.js', {packageName});

  uncache(files, packageName);

  // eslint-disable-next-line global-require
  require(`${process.cwd()}/packages/node_modules/@ciscospark/jsdoctrinetest`);
  await mochaTest(options, packageName, 'documentation', files.map((f) => `packages/node_modules/${packageName}/${f}`));

  uncache(files, packageName);

  debug(`Finished documentation suite for ${packageName}`);
}

async function runNodeSuite(options, packageName) {
  debug(`Running node suite for ${packageName}`);
  const files = await gatherFiles(options, packageName);
  if (files.length === 0) {
    debug(`no files found for ${packageName}`);
    return;
  }

  uncache(files, packageName);

  // Intercept require statements for the module under test and instead load the
  // instrumented files. This *should* continue to isolate code coverage since
  // we're running each package's test in a separate process, even when simply
  // running `npm test`.
  const load = require.extensions['.js'];
  if (options.coverage) {
    require.extensions['.js'] = function loadCoveredFile(m, filename) {
      if (filename.includes(packageName)) {
        filename = filename.replace(`${packageName}/dist`, `${packageName}/.coverage/src`);
      }
      return load(m, filename);
    };
  }

  await mochaTest(options, packageName, 'node', files);
  if (options.coverage) {
    require.extensions['.js'] = load;
  }

  uncache(files, packageName);

  debug(`Finished node suite for ${packageName}`);
}

async function runBrowserSuite(options, packageName) {
  debug(`Running browser suite for ${packageName}`);
  const files = await gatherFiles(options, packageName);
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
