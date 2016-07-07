/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-disable */

import testUsers from '@ciscospark/test-helper-test-users';
import ciscospark from '../../../es6';

beforeEach(function() {
  this.timeout(60000);
  if (ciscospark.credentials.authorization.access_token) {
    return;
  }

  return testUsers.create({count: 1})
    .then((users) => {
      /* eslint camelcase: [0] */
      ciscospark.credentials.authorization.access_token = users[0].token.access_token;
      ciscospark.credentials.authorization.refresh_token = users[0].token.refresh_token;
    });
});

after(() => {
  ciscospark.credentials.authorization.access_token = undefined;
  ciscospark.credentials.authorization.refresh_token = undefined;
});
