/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {makeStateDataType, oneFlight} from '@ciscospark/common';
import {SparkPlugin} from '@ciscospark/spark-core';
import TokenCollection from './token-collection';
import Token from './token';

export const apiScope = process.env.CISCOSPARK_SCOPE
  .split(` `)
  .filter((item) => item !== `spark:kms`)
  .sort()
  .join(` `);

const Credentials = SparkPlugin.extend({
  dataTypes: {
    token: makeStateDataType(Token, `token`).dataType
  },

  props: {
    supertoken: makeStateDataType(Token, `token`).prop
  },

  collections: {
    userTokens: TokenCollection
  },

  namespace: `Credentials`,

  /**
   * Gets a token with the specified scope
   */
  getUserToken(scope) {

  },

  getAuthorization(...args) {
    return this.getUserToken(...args);
  },

  /**
   *
   */
  @oneFlight
  refresh() {

  },

  /**
   * Exchanges an authorization code for an access token
   */
  @oneFlight
  requestAuthorizationCodeGrant() {

  },

  /**
   * Exchanges oauth config for a client credentials access token
   */
  @oneFlight
  requestClientCredentialsGrant() {

  },

  /**
   * Exchanges an orgId/password/name triple for an access token. If you're
   * considering using this method, you're almost certainly interested in "bots"
   * rather than "machine accounts". See the developer portal for more
   * information.
   */
  @oneFlight
  requestSamlExtensionGrant() {

  }
});

export default Credentials;
