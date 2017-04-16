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

require(`babel-register`)({
  only: [
    `./packages/node_modules/{*,*/*}/test/**/*.js`
  ],
  sourceMaps: true
});

// TODO xunit
// TODO doc tests
// TODO support circle node distribution
// TODO remove coverage before publishing
// TODO node only, browser only, unit only, automation only, doc only
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

async function testSinglePackage(packageName) {
  if (process.env.COVERAGE) {
    await instrument(packageName);
  }
  let err;
  try {
    await runMochaSuite(packageName);
  }
  catch (error) {
    err = error;
  }
  await runKarmaSuite(packageName);
  if (process.env.COVERAGE) {
    await collect(packageName);
    await deinstrument(packageName);
  }
  if (err) {
    throw err;
  }
  if (process.env.COVERAGE) {
    await combine(packageName);
  }
}

// eslint-disable-next-line no-extra-parens
(async function main() {
  try {
    await testSinglePackage(`@ciscospark/common`);
    if (process.env.COVERAGE) {
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
