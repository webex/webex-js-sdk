/**!
 *
 * Copyright (c) 2015 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {registerPlugin} from '../../spark-core';
import AuthInterceptor from './auth-interceptor';
import Credentials from './credentials';

registerPlugin(`credentials`, Credentials, {
  proxies: [
    `isAuthenticated`,
    `isAuthenticating`
  ],
  interceptors: {
    AuthInterceptor: AuthInterceptor.create
  }
});

export {default as default} from './credentials';
export {default as Authorization} from './authorization';
export {default as grantErrors} from './grant-errors';
