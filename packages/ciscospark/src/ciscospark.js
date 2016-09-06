/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

/* eslint camelcase: [0] */

import '@ciscospark/plugin-phone';

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

// documentation.js puts hashes in relative urls, so need to specify full urls
// here
/**
 * See {@link https://ciscospark.github.io/spark-js-sdk/example/browsers|Browser Guide} and
 * {@link https://ciscospark.github.io/spark-js-sdk/example/servers|Server Guide}
 * @see {@link /example/browsers|Browser Guide}
 * @see {@link /example/servers|Server Guide}
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
 * Create a new ciscospark instance.
 * Note: ciscospark.init() really only applies to node apps at this time. In web
 * browsers, you'll want to stick with manipulating the ciscospark instance you
 * get from `require('ciscospark')`
 * @param {Object} attrs
 * @param {Object} attrs.credentials (optional)
 * @param {Object} attrs.device (optional)
 * @param {Object} attrs.config (optiona)
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
