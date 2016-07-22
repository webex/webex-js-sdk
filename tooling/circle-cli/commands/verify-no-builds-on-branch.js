'use strict';

const _ = require(`lodash`);
const CircleCI = require(`circleci`);
const common = require(`../lib/common-options`);
const exitWithError = require(`../lib/exit-with-error`);
const tap = require(`../lib/tap`);

const blockUntilQueueEmpty = _.curry(function blockUntilQueueEmpty(argv, ci) {
  return ci.getBranchBuilds(argv)
    .then((builds) => {
      if (_.filter(builds, {status: `pending`}).length > 0 || _.filter(builds, {status: `running`}).length > 0) {
        return new Promise((resolve) => {
          console.log('waiting for queue to drain')
          setTimeout(() => resolve(blockUntilQueueEmpty(argv, ci)), argv.interval);
        });
      }

      return Promise.resolve();
    });
});

module.exports = {
  command: `verify-no-builds-on-branch`,
  describe: `Block until there are no builds running for the specified branch`,
  builder: Object.assign({}, common, {
    branch: {
      demand: true,
      describe: `Branch to build`,
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

    const ci = new CircleCI({
      auth: argv.auth
    });

    blockUntilQueueEmpty(argv, ci)
      .then(tap(() => console.log(`queue is empty`)))
      .catch(exitWithError);
  }
};
