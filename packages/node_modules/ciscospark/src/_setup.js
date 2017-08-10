/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

// Disable eslint because this file needs to be es5 compatible
/* eslint-disable */

var testUsers = require('@ciscospark/test-helper-test-users');
var CiscoSpark = require(`ciscospark`);

before(function() {
  this.timeout(60000);

  if (global.ciscospark) {
    return Promise.resolve();
  }

  return testUsers.create({count: 1})
    .then(function(users) {
      /* eslint camelcase: [0] */
      global.ciscospark = new CiscoSpark({credentials: users[0].token});
    });
});
