#!/usr/bin/env babel-node

'use strict';

/* eslint-disable require-jsdoc */
/* eslint-disable complexity */

const dotenv = require(`dotenv`);
dotenv.config({path: `.env.default`});
dotenv.config();
process.env.NODE_ENV = `test`;

const g = require(`glob`);
const debug = require(`debug`)(`monorepo:test`);
const {glob, list} = require(`./util/package`);
const path = require(`path`);
const {Server} = require(`karma`);
const {makeConfig} = require(`../karma-ng.conf`);
const Mocha = require(`mocha`);
const {
  collect,
  combine,
  deinstrument,
  instrument,
  report
} = require(`./util/coverage`);
const {start, stop} = require(`./util/server`);
const spawn = require(`./util/spawn`);
const yargs = require(`yargs`);

const {watchSauce} = require(`./karma`);

require(`babel-register`)({
  only: [
    `./packages/node_modules/**/*.js`
  ],
  plugins: [
    path.resolve(__dirname, `./babel-plugin-inject-package-version`)
  ],
  sourceMaps: true
});

const argv = yargs
  .env(``)
  .help()
  .options({
    coverage: {
      description: `Generate code coverage report`,
      default: false,
      type: `boolean`
    },

    xunit: {
      description: `Generate xunit xml reports. Note: exit code will always be zero of reports are generated successfully, even if tests fail`,
      default: false,
      type: `boolean`
    },

    browser: {
      description: `Run tests in browser( defaults to true if --node is not specified)`,
      default: false,
      type: `boolean`
    },
    node: {
      description: `Run tests in node (defaults to true if --browser is not specified)`,
      default: false,
      type: `boolean`
    },

    unit: {
      description: `Run unit tests (defaults to true if --integration and --automation are not specified)`,
      default: false,
      type: `boolean`
    },
    integration: {
      description: `Run integration tests (defaults to true if --unit and --automation are not specified)`,
      default: false,
      type: `boolean`
    },
    automation: {
      description: `Run automation tests (defaults to true if --unit and --integration are not specified)`,
      default: false,
      type: `boolean`
    },

    grep: {
      description: `Run a subset of tests`,
      default: [],
      type: `array`
    },

    karmaDebug: {
      description: `Start karma in watch mode`,
      default: false,
      type: `boolean`
    },

    serve: {
      description: `Start the fixture server. Since this defaults to true, you find --no-serve useful`,
      default: true,
      type: `boolean`
    }
  })
  .argv;

if (!argv.browser && !argv.node) {
  argv.browser = argv.node = true;
}

if (!argv.unit && !argv.integration && !argv.automation) {
  argv.unit = argv.integration = argv.automation = true;
}

if (argv.automation && !argv.unit && !argv.integration) {
  argv.browser = false;
}

if (argv.grep.length > 1 && argv.browser) {
  throw new Error(`Karma only supports a single pattern; only specify --grep once when running browser tests`);
}

async function runAutomationSuite(packageName) {
  let files = [];
  files = files.concat(await glob(`test/automation/spec/**/*.js`, {packageName}));
  await runMochaSuite(packageName, `automation`, files);
}

async function runNodeSuite(packageName) {
  let files = [];
  if (argv.unit) {
    files = files.concat(await glob(`test/unit/spec/**/*.js`, {packageName}));
  }
  if (argv.integration) {
    files = files.concat(await glob(`test/integration/spec/**/*.js`, {packageName}));
  }

  // Intercept require statements for the module under test and instead load the
  // instrumented files. This *should* continue to isolate code coverage since
  // we're running each package's test in a separate process, even when simply
  // running `npm test`.
  if (argv.coverage) {
    const load = require.extensions[`.js`];
    require.extensions[`.js`] = function loadCoveredFile(m, filename) {
      if (filename.includes(packageName)) {
        filename = filename.replace(`${packageName}/dist`, `${packageName}/.coverage/src`);
      }
      return load(m, filename);
    };
  }

  await runMochaSuite(packageName, `node`, files);
}

async function runMochaSuite(packageName, suite, files) {
  debug(`mocha: testing ${packageName}`);
  const cfg = {
    timeout: 30000
  };
  if (argv.xunit) {
    cfg.reporter = `packages/node_modules/@ciscospark/xunit-with-logs`;
    cfg.reporterOptions = {
      output: `reports/junit/${packageName}-${suite}.xml`
    };
  }

  cfg.grep = new RegExp(argv.grep.join(`|`));

  const mocha = new Mocha(cfg);

  if (files.length === 0) {
    debug(`mocha: no tests found for ${packageName}`);
    return Promise.resolve();
  }

  files.forEach((f) => mocha.addFile(path.join(`packages/node_modules`, packageName, f)));
  return new Promise((resolve, reject) => {
    mocha.run((failures) => {
      debug(`mocha: tested ${packageName}`);
      if (argv.xunit) {
        const reports = g.sync(`reports/junit/${packageName}-${suite}.xml`);
        if (reports.length === 0) {
          reject(new Error(`No mocha reports generated for ${packageName}`));
        }
        else {
          resolve();
        }
        return;
      }

      if (!failures) {
        resolve();
        return;
      }
      reject(new Error(`Mocha suite failed`));
    });
  });
}

async function runKarmaSuite(packageName) {
  debug(`karma: testing ${packageName}`);
  let files = [];
  if (argv.unit) {
    files = files.concat(await glob(`test/unit/spec/**/*.js`, {packageName}));
  }
  if (argv.integration) {
    files = files.concat(await glob(`test/integration/spec/**/*.js`, {packageName}));
  }

  if (files.length === 0) {
    debug(`karma: no tests found for ${packageName}`);
    return Promise.resolve();
  }

  const cfg = makeConfig(packageName, argv);
  return new Promise((resolve, reject) => {
    const server = new Server(cfg, (code) => {
      debug(`karma: tested ${packageName}`);
      if (argv.xunit) {
        const reports = g.sync(`reports/junit/*/${packageName}-karma.xml`);
        if (reports.length === 0) {
          reject(new Error(`No karma reports generated for ${packageName}`));
        }
        else {
          resolve();
        }
        return;
      }

      if (!code) {
        resolve();
        return;
      }

      reject(new Error(`Karma suite failed`));
    });

    if (process.env.SC_TUNNEL_IDENTIFIER) {
      watchSauce(server, cfg);
    }

    server.start(cfg);
  });
}

// eslint-disable-next-line complexity
async function testSinglePackage(packageName) {
  if (packageName === `generator-ciscospark`) {
    await runNodeSuite(packageName);
    return;
  }

  if (argv.node) {
    let err;
    if (argv.coverage) {
      await instrument(packageName);
    }
    try {
      await runNodeSuite(packageName);
    }
    catch (error) {
      err = error;
    }
    if (argv.coverage) {
      await deinstrument(packageName);
    }
    if (err) {
      throw err;
    }
  }

  if (argv.browser) {
    await runKarmaSuite(packageName);
  }

  if (argv.automation) {
    await runAutomationSuite(packageName);
  }

  if (argv.coverage) {
    await collect(packageName);
  }

  if (argv.coverage) {
    await combine(packageName);
  }
}

async function testAllPackages() {
  // TODO a future revision should check for test files rather than assuming all
  // the following patterns indicate a lack of tests.
  let packages = (await list())
    .filter((p) => !p.includes(`test-helper`))
    .filter((p) => !p.includes(`bin-`))
    .filter((p) => !p.includes(`example-phone`));

  // TODO a future revision should figure out how to get timing data into and
  // out of circle to use its node balancing helpers.
  const CIRCLE_NODE_TOTAL = parseInt(process.env.CIRCLE_NODE_TOTAL || 1, 10);
  const CIRCLE_NODE_INDEX = parseInt(process.env.CIRCLE_NODE_INDEX || 0, 10);

  if (CIRCLE_NODE_TOTAL !== 1) {
    packages = packages.filter((packageName, index) => index % CIRCLE_NODE_TOTAL === CIRCLE_NODE_INDEX);
  }

  for (const packageName of packages) {
    debug(`Testing ${packageName} on this node`);
    const argString = Object.keys(argv).reduce((acc, key) => {
      const value = argv[key];
      if (typeof value === `boolean`) {
        acc += value ? ` --${key}` : ` --no-${key}`;
      }
      return acc;
    }, ``);
    const [cmd, ...args] = `npm run test --silent -- --package ${packageName}${argString}`.split(` `);
    await spawn(cmd, args);
  }
}

// eslint-disable-next-line no-extra-parens
(async function main() {
  try {
    if (argv.package) {
      if (argv.serve) {
        debug(`starting test server`);
        await start();
        debug(`started test server`);
      }

      debug(`testing single package ${argv.package}`);
      await testSinglePackage(argv.package);
      debug(`tested single package ${argv.package}`);

      if (argv.serve) {
        debug(`stopping test server`);
        await stop();
        debug(`stopped test server`);
      }
    }
    else {
      debug(`testing all packages`);
      await testAllPackages();
      debug(`tested all packages`);
    }

    if (argv.coverage) {
      debug(`generating overall coverage report`);
      await report();
      debug(`generated overall coverage report`);
    }
  }
  catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    // eslint-disable-next-line no-process-exit
    process.exit(64);
  }

  for (const handle of process._getActiveHandles()) {
    // unref any outstanding timers/sockets/streams/processes.
    handle.unref();
  }
}());
