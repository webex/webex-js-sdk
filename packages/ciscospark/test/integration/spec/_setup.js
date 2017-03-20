/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import testUsers from '@ciscospark/test-helper-test-users';
import spark from '../..';

before(function() {
  this.timeout(60000);
  return testUsers.create({count: 1})
    .then((users) => {
      /* eslint camelcase: [0] */
      spark.credentials.authorization.access_token = users[0].token.access_token;
      spark.credentials.authorization.refresh_token = users[0].token.refresh_token;
      // Cheat a little to pass around the current user.
      spark.$user = users[0];
    });
});
