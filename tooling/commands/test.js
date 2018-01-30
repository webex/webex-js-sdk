/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-disable complexity */

const debug = require(`debug`)(`tooling:test:command`);
const wrapHandler = require(`../lib/wrap-handler`);
const {testPackage} = require(`../lib/test`);
const {list} = require(`../lib/package`);
const spawn = require(`../util/spawn`);
const {report} = require(`../util/coverage`);
const {start, stop} = require(`../util/server`);

module.exports = {
  command: `test`,
  desc: `Run the test suite`,
  builder: {
    coverage: {
      description: `Generate code coverage`,
      default: false,
      type: `boolean`
    },

    coverageReport: {
      description: `Internal; when false, no report is generated`,
      default: true,
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
    documentation: {
      description: `Check source code for examples and run any containing assertions`,
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
  },
  handler: wrapHandler(async (argv) => {
    if (!argv.browser && !argv.node) {
      argv.browser = argv.node = true;
    }

    if (!argv.unit && !argv.integration && !argv.automation && !argv.documentation) {
      argv.unit = argv.integration = argv.automation = argv.documentation = true;
    }

    if (argv.automation && !argv.unit && !argv.integration && !argv.documentation) {
      argv.browser = false;
    }

    if (argv.package) {
      if (argv.serve) {
        debug(`starting test server`);
        await start();
        debug(`started test server`);
      }

      await testPackage(argv, argv.package);

      if (argv.serve) {
        debug(`stopping test server`);
        await stop();
        debug(`stopped test server`);
      }
    }
    else {
      for (const packageName of await list()) {
        const argString = Object.keys(argv).reduce((acc, key) => {
          const value = argv[key];
          if (typeof value === `boolean`) {
            acc += value ? ` --${key}` : ` --no-${key}`;
          }
          return acc;
        }, ``);
        const [cmd, ...args] = `npm run test --silent -- --no-coverage-report --package ${packageName}${argString}`.split(` `);
        await spawn(cmd, args);
      }
    }

    if (argv.coverage && argv.coverageReport) {
      debug(`generating overall coverage report`);
      await report();
      debug(`generated overall coverage report`);
    }

    for (const handle of process._getActiveHandles()) {
      // unref any outstanding timers/sockets/streams/processes.
      handle.unref();
    }
  })
};
