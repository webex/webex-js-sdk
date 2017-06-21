'use strict';

const debug = require(`debug`)(`tooling:test:mocha`);
const Mocha = require(`mocha`);
const {expectReports, expectNonEmptyReports, expectNoKmsErrors} = require(`./common`);
const {readFile} = require(`fs-promise`);
const path = require(`path`);
const {cloneDeep} = require(`lodash`);

exports.test = async function test(options, packageName, suite, files) {
  const config = JSON.parse(await readFile(path.join(process.cwd(), `.babelrc`)));
  const nodeConfig = cloneDeep(config);
  Reflect.deleteProperty(nodeConfig.presets.find((item) => Array.isArray(item) && item[0] === `env`)[1].targets, `browsers`);
  nodeConfig.plugins.forEach((item, index) => {
    if (!Array.isArray(item) && item.startsWith(`./`)) {
      nodeConfig.plugins[index] = path.resolve(process.cwd(), item);
    }
  });

  if (options.building) {
    nodeConfig.only = [
      `./packages/node_modules/**/test/**/*.js`
    ];
  }
  else {
    nodeConfig.only = [
      `./packages/node_modules/**`
    ];
  }

  nodeConfig.babelrc = false;

  // eslint-disable-next-line global-require
  require(`babel-register`)(nodeConfig);

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
