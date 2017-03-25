/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

// Disable eslint because this file needs to be es5 compatible
/* eslint-disable */

var testUsers = require('@ciscospark/test-helper-test-users');
var ciscospark = require('..');

before(function() {
  this.timeout(60000);

  if (ciscospark.credentials.authorization.access_token) {
    return Promise.resolve();
  }
  return testUsers.create({count: 1})
    .then(function(users) {
      /* eslint camelcase: [0] */
      ciscospark.credentials.authorization.access_token = users[0].token.access_token;
      ciscospark.credentials.authorization.refresh_token = users[0].token.refresh_token;
    });
});

after(function() {
  ciscospark.credentials.authorization.access_token = undefined;
  ciscospark.credentials.authorization.refresh_token = undefined;
});
