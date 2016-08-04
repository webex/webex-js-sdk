'use strict';

// See https://circleci.com/docs/api/#recent-builds for list of statuses. Note
// that the categories below are largely guesses.

module.exports = {
  completionStatuses: [
    `failed`,
    `retried`,
    `canceled`,
    `infrastructure_fail`,
    `timedout`,
    `not_run`,
    `no_tests`,
    `fixed`,
    `success`
  ],

  pendingStatuses: [
    `running`,
    `queued`,
    `scheduled`,
    `not_running`
  ]
};
