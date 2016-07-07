/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

/* eslint camelcase: [0] */

import {defaults, get, has, set} from 'lodash';
import CiscoSpark, {children, registerPlugin} from '@ciscospark/spark-core';
import AuthInterceptor from './interceptors/auth';
import Memberships from './plugins/memberships';
import Messages from './plugins/messages';
import People from './plugins/people';
import Rooms from './plugins/rooms';
import Teams from './plugins/teams';
import TeamMemberships from './plugins/team-memberships';
import Webhooks from './plugins/webhooks';
import config from './config';

// This shouldn't be necessary once the plugins are moved to their own packages
const interceptors = {};
if (!children.device) {
  interceptors[`AuthInterceptor`] = AuthInterceptor.create;
}

registerPlugin(`memberships`, Memberships, {
  interceptors
});
registerPlugin(`messages`, Messages);
registerPlugin(`people`, People);
registerPlugin(`rooms`, Rooms);
registerPlugin(`teams`, Teams);
registerPlugin(`teamMemberships`, TeamMemberships);
registerPlugin(`webhooks`, Webhooks);

/**
 * SDK for Cisco Spark
 *
 * ## Installation
 *
 * ```javascript
 * npm install --save ciscospark
 * ```
 *
 * ## A Note on Browsers
 * Ciscospark is fully browser compatible but we don't distribute a browserified
 * bundle at this time; you'll need to build the bundle yourself. We use
 * [browserify](http://browserify.org/) internally and
 * [webpack](https://webpack.github.io/) should work as well.
 *
 * ## Getting Started
 *
 * > The examples below have both ES5 and ES6 variations. The ES6 examples will
 * > require you to build your project using [babel](https://babeljs.io). The
 * > ES5 examples should be directly runnable.
 *
 * The quickest way to get started is to set your access token as an environment
 * variable:
 *
 * ```javascript
 * <%= gettingstarted__accesstoken_es6 %>
 * ```
 * ```javascript
 * <%= gettingstarted__accesstoken %>
 * ```

 * ### Refresh Tokens
 *
 * For long-running use cases, you'll need to provide a refresh token, client
 * id, and client secret:
 *
 * ```javascript
 * <%= gettingstarted__oauth__refreshtokens_es6 %>
 * ```
 *
 * ## Runtime Configuration
 *
 * While environment variables are handy for development, they don't really help
 * you write an app for lots of users. You can pass credentials to the spark
 * using init.
 *
 * ```javascript
 * <%= gettingstarted__runtimeconfiguration__init_es6 %>
 * ```
 *
 * ## OAuth
 *
 * OAuth is baked right into spark so you don't need to figure it out.
 *
 * To kick off an OAuth login, simply call `spark.authenticate()` which will
 * direct the current app to our login page.
 *
 * ```javascript
 * <%= gettingstarted__oauth__authenticate_es6 %>
 * ```
 *
 * To refresh an access token, call `spark.authorize()`. (Note: this should
 * generally happen for you automatically).
 *
 * ```javascript
 * <%= gettingstarted__oauth__authorize_es6 %>
 * ```
 *
 * @class CiscoSpark
 * @extends SparkCore
 */
const ciscospark = new CiscoSpark({
  credentials: {
    authorization: {
      access_token: process.env.CISCOSPARK_ACCESS_TOKEN,
      refresh_token: process.env.CISCOSPARK_REFRESH_TOKEN
    }
  },
  config
});

/**
 * While environment variables are handy for development, they don't really help
 * you write an app for lots of users. You can pass credentials to the spark
 * using init.
 * @param {Object} attrs
 * @param {Object} attrs.credentials
 * @memberof CiscoSpark
 * @returns {CiscoSpark}
 */
ciscospark.init = function init(attrs) {
  if (has(attrs, `credentials.access_token`) || has(`credentials.refresh_token`)) {
    attrs.credentials.authorization = {};
    [
      `access_token`,
      `token_type`,
      `expires`,
      `expires_in`,
      `refresh_token`,
      `refresh_token_expires`,
      `refresh_token_expires_in`
    ].forEach((key) => {
      set(attrs, `credentials.authorization.${key}`, get(attrs, `credentials.${key}`));
      Reflect.deleteProperty(attrs.credentials, key);
    });
  }

  attrs.config = defaults(attrs.config, config);

  return new CiscoSpark(attrs);
};

export default ciscospark;
