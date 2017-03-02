/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
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

export {Credentials as default};
export {Credentials as Credentials};
export {default as Authorization} from './authorization';
export {default as grantErrors} from './grant-errors';
export {AuthInterceptor as AuthInterceptor};
