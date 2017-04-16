#!/usr/bin/env babel-node

/* eslint-disable require-jsdoc */

require(`dotenv`).config({path: `.env.default.json`});
require(`dotenv`).config();

const {glob} = require(`./util/package`);
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

const yargs = require(`yargs`);

require(`babel-register`)({
  only: [
    `./packages/node_modules/{*,*/*}/test/**/*.js`
  ],
  sourceMaps: true
});

const argv = yargs
  // .env(``)
  .options({
    coverage: {
      default: false,
      type: `boolean`
    },

    xunit: {
      default: false,
      type: `boolean`
    },

    browser: {
      default: false,
      type: `boolean`
    },
    node: {
      default: false,
      type: `boolean`
    }

    // TODO unit/integration/automation
    // unit: {
    //   default: false,
    //   type: `boolean`
    // },
    // integration: {
    //   default: false,
    //   type: `boolean`
    // },
    // automation: {
    //   default: false,
    //   type: `boolean`
    // }
  })
  .argv;

if (!argv.browser && !argv.node) {
  argv.browser = argv.node = true;
}

// if (!argv.unit && !argv.integration && !argv.automation) {
//   argv.unit = argv.integration = argv.automation = true;
// }
// TODO test server
// TODO automation
// TODO all packages
// TODO support circle node distribution
// FIXME xunit logger isn't collecting logs
// TODO doc tests
// FIXME karma coverage reporter isn't producing output

async function runMochaSuite(packageName) {
  const cfg = {};
  if (process.env.XUNIT) {
    cfg.reporter = `packages/node_modules/@ciscospark/xunit-with-logs`;
    cfg.reporterOptions = {
      output: `reports/junit/${packageName}-mocha.xml`
    };
  }

  const mocha = new Mocha(cfg);
  const pattern = `test/*/spec/**/*.js`;
  const files = await glob(pattern, {packageName});
  files.forEach((f) => mocha.addFile(path.join(`packages/node_modules`, packageName, f)));
  return new Promise((resolve, reject) => {
    mocha.run((failures) => {
      if (!failures || process.env.XUNIT) {
        resolve();
        return;
      }
      reject(new Error(`Mocha suite failed`));
    });
  });
}

async function runKarmaSuite(packageName) {
  const cfg = makeConfig(packageName);
  return new Promise((resolve, reject) => {
    const server = new Server(cfg, (code) => {
      if (!code || process.env.XUNIT) {
        resolve();
        return;
      }

      reject(new Error(`Karma suite failed`));
    });
    server.start(cfg);
  });
}

// eslint-disable-next-line complexity
async function testSinglePackage(packageName) {
  if (argv.coverage) {
    await instrument(packageName);
  }
  let err;
  try {
    const promises = [];
    if (argv.node) {
      promises.push(runMochaSuite(packageName));
    }
    if (argv.browser) {
      promises.push(runKarmaSuite(packageName));
    }

    await Promise.all(promises);
  }
  catch (error) {
    err = error;
  }

  if (argv.coverage) {
    await collect(packageName);
    await deinstrument(packageName);
  }
  if (err) {
    throw err;
  }
  if (argv.coverage) {
    await combine(packageName);
  }
}

// eslint-disable-next-line no-extra-parens
(async function main() {
  try {
    await testSinglePackage(`@ciscospark/common`);
    if (argv.coverage) {
      await report();
    }
  }
  catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    // eslint-disable-next-line no-process-exit
    process.exit(64);
  }
}());
