/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import '@ciscospark/plugin-wdm';

import {registerPlugin} from '@ciscospark/spark-core';
import Credentials from './credentials';
import config from './config';
import AdvancedAuthInterceptor from './interceptor';

const proxies = [
  `canAuthorize`
];

if (typeof window !== `undefined`) {
  proxies.push(`isLoggedIn`);
}

registerPlugin(`credentials`, Credentials, {
  config,
  proxies,
  interceptors: {
    AuthInterceptor: AdvancedAuthInterceptor.create
  },
  // We're replacing the default credentials implementation with this more
  // advanced one
  replace: true
});

export {
  apiScope,
  default as default
} from './credentials';
export {default as Token} from './token';
export {default as TokenCollection} from './token-collection';
export {default as config} from './config';
