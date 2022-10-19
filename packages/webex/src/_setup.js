/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

// Disable eslint because this file needs to be es5 compatible
/* eslint-disable */

var testUsers = require('@webex/test-helper-test-users');
var Webex = require(`webex`);

before(function() {
  this.timeout(60000);

  if (global.webex) {
    return Promise.resolve();
  }

  return testUsers.create({count: 1})
    .then(function(users) {
      /* eslint camelcase: [0] */
      global.webex = new Webex({credentials: users[0].token});
    });
});
