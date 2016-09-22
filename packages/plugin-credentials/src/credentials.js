/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

/* eslint camelcase: [0] */

import {oneFlight, whileInFlight} from '@ciscospark/common';
import {grantErrors, SparkPlugin} from '@ciscospark/spark-core';
import Token from './token';
import {filterScope} from './scope';
import {has} from 'lodash';

export const apiScope = filterScope(`spark:kms`, process.env.CISCOSPARK_SCOPE);

const Credentials = SparkPlugin.extend({
  namespace: `Credentials`,

  /**
   * Exchanges oauth config for a client credentials access token
   */
  @whileInFlight(`isAuthenticating`)
  @oneFlight
  requestClientCredentialsGrant(options) {
    const vars = {
      client_id: `CLIENT_ID`,
      client_secret: `CLIENT_SECRET`
    };

    for (const key in vars) {
      if (!has(this.config, key)) {
        const baseVar = vars[key];
        return Promise.reject(new Error(`config.credentials.${key} or CISCOSPARK_${baseVar} or COMMON_IDENTITY_${baseVar} or ${baseVar} must be defined`));
      }
    }

    this.logger.info(`credentials: requesting client credentials grant`);

    options = options || {};
    options.scope = options.scope || `webexsquare:admin`;

    return this.spark.request({
      method: `POST`,
      api: `oauth`,
      resource: `access_token`,
      form: {
        grant_type: `client_credentials`,
        scope: options.scope,
        self_contained_token: true
      },
      auth: {
        user: this.config.client_id,
        pass: this.config.client_secret,
        sendImmediately: true
      },
      shouldRefreshAccessToken: false
    })
      .then((res) => new Token(res.body, {parent: this}))
      .catch((res) => {
        if (res.statusCode !== 400) {
          return Promise.reject(res);
        }

        const ErrorConstructor = grantErrors.select(res.body.error);
        return Promise.reject(new ErrorConstructor(res._res || res));
      });
  }
});

export default Credentials;
