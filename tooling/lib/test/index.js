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
const wrap = require('../wrap-unwrap');
const Module = require('module');

/* eslint-disable complexity */

exports.testPackage = async function testPackage(options, packageName) {
  debug(`testing ${packageName}`);

  registerBabel(options, packageName);

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

function registerBabel(options) {
  let pattern;
  if (options.raw) {
    pattern = './packages/node_modules/**/*.js';
  }
  else {
    pattern = './packages/node_modules/**/test/**/*.js';
  }

  // eslint-disable-next-line global-require
  require('babel-register')({
    only: [pattern],
    plugins: [
      path.resolve(__dirname, '../../babel-plugin-inject-package-version')
    ],
    sourceMaps: true
  });
}

async function runDocsSuite(options, packageName) {
  if (options.raw) {
    // eslint-disable-next-line no-console
    console.warn('Skipping doc tests due to "raw" specification');
    // eslint-disable-next-line no-console
    console.warn('At this time, jsdoctrinetest doesn\'t play nicely with other babel transforms');
    // eslint-disable-next-line no-console
    console.warn('Please run documentation tests against built code');
    return;
  }

  debug(`Running documentation tests for ${packageName}`);
  const files = await glob('dist/**/*.js', {packageName});
  // eslint-disable-next-line global-require
  require(`${process.cwd()}/packages/node_modules/@ciscospark/jsdoctrinetest`);
  await mochaTest(options, packageName, 'documentation', files.map((f) => `packages/node_modules/${packageName}/${f}`));
  debug(`Finished documentation suite for ${packageName}`);
}

async function runNodeSuite(options, packageName) {
  debug(`Running node suite for ${packageName}`);
  const files = await gatherFiles(options, packageName);
  if (files.length === 0) {
    debug(`no files found for ${packageName}`);
    return;
  }

  // Intercept require statements for the module under test and instead load the
  // instrumented files. This *should* continue to isolate code coverage since
  // we're running each package's test in a separate process, even when simply
  // running `npm test`.
  if (options.coverage) {
    debug('injecting coverage hook');
    // FIXME this should load dist code
    require.extensions['.js'] = wrap(require.extensions['.js'], function loadCoveredFile(fn, m, filename) {
      if (filename.includes(packageName)) {
        filename = filename.replace(`${packageName}/dist`, `${packageName}/.coverage/src`);
      }
      // eslint-disable-next-line no-invalid-this
      return Reflect.apply(fn, this, [m, filename]);
    });
  }

  if (options.raw) {
    debug('injecting raw hook');

    Module._resolveFilename = wrap(Module._resolveFilename, function resolveToSrcIndex(_resolveFilename, request, parent, isMain) {
      if (request.startsWith('@ciscospark') && request.split('/').length === 2 || request === 'ciscospark') {
        request = path.resolve(process.cwd(), 'packages', 'node_modules', request, 'src/index.js');
      }
      // eslint-disable-next-line no-invalid-this
      return Reflect.apply(_resolveFilename, this, [request, parent, isMain]);
    });
  }

  await mochaTest(options, packageName, 'node', files);
  if (options.raw) {
    debug('removing raw hook');
    Module._resolveFilename = Module._resolveFilename.unwrap();
  }

  if (options.coverage) {
    debug('removing coverage hook');
    require.extensions['.js'] = require.extensions['.js'].unwrap();
  }

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
