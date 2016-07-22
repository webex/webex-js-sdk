'use strict';

const _ = require(`lodash`);

module.exports = _.curry(function blockUntilComplete(argv, ci, build) {
  return ci.getBuild(build)
    .then((result) => {
      // eslint-disable-next-line camelcase
      let str = `${(new Date()).toISOString()}: build number ${result.build_num} has status ${result.status} on Circle CI`;
      if (result.start_time) {
        str += `(started at ${result.start_time})`;
      }
      else if (result.usage_queued_at) {
        str += `(started at ${result.usage_queued_at})`;
      }
      console.log(str);
      if ([`pending`, `queued`, `running`].indexOf(result.status) !== -1) {
        return new Promise((resolve) => {
          setTimeout(() => resolve(blockUntilComplete(argv, ci, build)), argv.interval);
        });
      }

      return result;
    });
});
