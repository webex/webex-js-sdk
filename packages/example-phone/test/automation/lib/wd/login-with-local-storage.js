/**!
 *
 * Copyright (c) 2015 Cisco Systems, Inc. See LICENSE file.
 */

import {wd} from '@ciscospark/test-helper-automation';
import {defaults, set} from 'lodash';

wd.addPromiseChainMethod(`loginWithLocalStorage`, function(user, options) {
  options = defaults(options, {
    key: `example-phone`,
    path: `spark.credentials.authorization`
  });

  if (!user) {
    throw new Error(`user is required`);
  }

  const token = user.token || user;
  if (!token.access_token) {
    throw new Error(`token is required`);
  }

  const data = {};
  set(data, options.path, token);

  return this
    .getMainPage()
    .waitForElementByClassName(`ready`)
    .setLocalStorageKey(options.key, JSON.stringify(data))
    .getMainPage()
    .waitForElementByClassName(`ready`)
    .assertAuthenticationStatus(`authenticated`)
    .assertConnectionStatus(`connected`);
});
