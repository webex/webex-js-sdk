'use strict';

const _ = require(`lodash`);
const blockUntilComplete = require(`../lib/block-until-complete`);
const CircleCI = require(`circleci`);
const common = require(`../lib/common-options`);
const downloadArtifacts = require(`../lib/download-artifacts`);
const exitWithError = require(`../lib/exit-with-error`);
const statusToXunit = require(`../lib/status-to-xunit`);
const tap = require(`../lib/tap`);

module.exports = {
  command: `trigger-build`,
  describe: `Start a build and block until it completes`,
  builder: Object.assign({}, common, {
    environment: {
      alias: `e`,
      default: [],
      demand: false,
      describe: `Environment variables to pass to the build`,
      type: `string`
    },
    interval: {
      alias: `i`,
      default: 30000,
      demand: false,
      describe: `Interval on which to poll for completion (in milliseconds)`,
      type: `number`
    }
  }),
  handler: (argv) => {
    if (argv.interval < 1000) {
      throw new Error(`Polling interval less than one second, aborting`);
    }

    argv.environment = argv.e = argv.environment.reduce((e, item) => {
      const kv = item.split(`=`);
      e[kv[0]] = kv[1];
      return e;
    }, {});

    argv.body = {
      // eslint-disable-next-line camelcase
      build_parameters: argv.environment
    };

    const ci = new CircleCI({
      auth: argv.auth
    });

    const build = _.pick(argv, `username`, `project`);

    return ci.startBuild(argv)
      .then((result) => {
        // eslint-disable-next-line camelcase
        build.build_num = result.build_num;
        return build;
      })
      .then(blockUntilComplete(argv, ci))
      .then(tap((result) => statusToXunit(argv, ci, result)))
      .then(tap(() => downloadArtifacts(argv, ci, build)))
      .then((result) => {
        console.log(`build ${build.build_num} completed with status ${result.status}`);
      })
      .catch(exitWithError);
  }
};
