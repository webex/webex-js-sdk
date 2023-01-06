import assert from 'assert';

import uuid from 'uuid';
import btoa from 'btoa';
import _ from 'lodash';
import randomName from 'node-random-name';
import {request} from '@webex/http-core';

const BASE_PATH_SECURE = '/users/test_users_s';
const BASE_PATH = '/users/test_users';

/**
 * Computes `expires` and `refresh_token_expires` from `expires_in` and
 * `refresh_token_expires_in` and creates an `authorization` string.
 * @param {Object} token
 * @private
 * @returns {Object}
 */
function fixToken(token) {
  const now = Date.now();

  if (token.expires_in && !token.expires) {
    token.expires = now + token.expires_in * 1000;
  }

  if (token.refresh_token_expires_in && !token.refresh_token_expires) {
    /* eslint camelcase: [0] */
    token.refresh_token_expires = now + token.refresh_token_expires_in * 1000;
  }

  if (token.token_type && token.access_token) {
    token.authorization = `${token.token_type} ${token.access_token}`;
  }

  return token;
}

let clientToken;

/**
 * Fetches credentials to talk to the test_users_s endpoint
 *
 * Caches result in `clientToken` variable for multiple runs
 * @param {Object} options
 * @param {string} options.clientId
 * @param {string} options.clientSecret
 * @param {string} options.idbrokerUrl
 * @private
 * @returns {String}
 */
function getClientCredentials({clientId, clientSecret, idbrokerUrl}) {
  if (clientToken) {
    return Promise.resolve(clientToken);
  }

  return request({
    method: 'POST',
    uri: `${idbrokerUrl}/idb/oauth2/v1/access_token`,
    json: true,
    form: {
      grant_type: 'client_credentials',
      scope: 'Identity:SCIM webexsquare:get_conversation',
      client_id: clientId,
      client_secret: clientSecret,
    },
    headers: {
      // Note: we can't request's auth hash here because this endpoint expects
      // us to send the auth header *without including "Basic "* before the
      // token string
      authorization: btoa(`${clientId}:${clientSecret}`),
    },
  })
    .then((res) => {
      const token = fixToken(res.body);

      return `${token.token_type} ${token.access_token}`;
    })
    .then((token) => {
      clientToken = token;

      return clientToken;
    });
}

/**
 * Makes a request authorized with client credentials
 * @param {Object} options
 * @param {Object} options.body
 * @param {string} options.body.clientId
 * @param {string} options.body.clientSecret
 * @param {string} options.body.idbrokerUrl
 * @private
 * @returns {Promise<HttpResponseObject>}
 */
function requestWithAuth(options) {
  return getClientCredentials(options.body).then((authorization) => {
    options.headers = options.headers || {};
    options.headers.authorization = authorization;

    return request(options);
  });
}

/**
 * @typedef {Object} AccessTokenObject
 * @property {string} token.access_token
 * @property {Number} token.expires_in
 * @property {string} token.token_type
 * @property {string} token.refresh_token
 * @property {Number} token.refresh_token_expires_in
 * @property {string} token.expires
 * @property {string} token.refresh_token_expires
 */

/**
 * @typedef {Object} CreateUserOptions
 * @property {boolean} [authCodeOnly] generates auth_code
 * @param {string} [clientId] defaults to WEBEX_CLIENT_ID
 * @param {string} [clientSecret] defaults to WEBEX_CLIENT_SECRET
 * @param {string} [cigServiceUrl] defaults to WEBEX_TEST_USERS_CI_GATEWAY_SERVICE_URL
 * @property {string} [displayName]
 * @property {string} [emailAddress]
 * @property {Array.<string>} [entitlements]
 * @param {string} [idbrokerUrl] defaults to IDBROKER_BASE_URL
 * @property {string} [machineType] used when creating a machine user/device
 * @property {string} [orgId] organization ID to create the user under
 * @property {string} [password] defaults to a random password
 * @property {string} [roles] defaults to []
 * @property {string} [scope] defaults to WEBEX_SCOPE
 * @property {string} [type] used to create a machine
 */

/**
 * @typedef {Object} TestUserObject
 * @property {string} password
 * @property {string} emailAddress
 * @property {string} displayName
 * @property {string} id
 * @property {string} userName
 * @property {string} email
 * @property {string} name
 * @property {string} givenName
 * @property {string} type
 * @property {Array.<string>} entitlements
 * @property {string} orgId
 * @property {AccessTokenObject} token
 */

/**
 * Creates a test user
 * @param {CreateUserOptions} options
 * @returns {Promise.<TestUserObject>}
 */
export function createTestUser(options = {}) {
  const clientId = options.clientId || process.env.WEBEX_CLIENT_ID;
  const clientSecret = options.clientSecret || process.env.WEBEX_CLIENT_SECRET;
  const idbrokerUrl = options.idbrokerUrl || process.env.IDBROKER_BASE_URL;
  const cigServiceUrl =
    options.cigServiceUrl ||
    process.env.WEBEX_TEST_USERS_CI_GATEWAY_SERVICE_URL ||
    process.env.WEBEX_TEST_USERS_CONVERSATION_SERVICE_URL;

  if (!clientId) {
    throw new Error('options.clientId or process.env.WEBEX_CLIENT_ID must be defined');
  }

  if (!clientSecret) {
    throw new Error('options.clientSecret or process.env.WEBEX_CLIENT_SECRET must be defined');
  }

  if (!idbrokerUrl) {
    throw new Error('options.idbrokerUrl or process.env.IDBROKER_BASE_URL must be defined');
  }

  if (!cigServiceUrl) {
    throw new Error(
      'options.cigServiceUrl or process.env.WEBEX_TEST_USERS_CI_GATEWAY_SERVICE_URL must be defined'
    );
  }

  const body = {
    authCodeOnly: options.authCodeOnly,
    clientId,
    clientSecret,
    displayName: options.displayName || randomName(),
    emailTemplate: options.emailAddress,
    entitlements: options.entitlements || [
      'spark',
      'squaredCallInitiation',
      'squaredRoomModeration',
      'squaredInviter',
      'webExSquared',
    ],
    idbrokerUrl,
    machineType: options.machineType,
    orgId: options.orgId,
    // The five characters on the end are to hit all the password requirements
    password: options.password || `${uuid.v4()}zAY1*`,
    roles: options.roles || [],
    scopes: options.scope || process.env.WEBEX_SCOPE,
    type: options.type,
  };

  return requestWithAuth({
    method: 'POST',
    uri: `${cigServiceUrl}${BASE_PATH_SECURE}`,
    json: true,
    body,
  }).then((res) => ({
    password: body.password,
    emailAddress: res.body.user.email,
    displayName: res.body.user.name,
    ...res.body.user,
    token: fixToken(res.body.token),
  }));
}

/**
 * Exchanges a user name/password for an access token
 * @param {Object} options
 * @param {string} options.id
 * @param {string} options.email
 * @param {string} options.password
 * @param {string} options.clientId
 * @param {string} options.clientSecret
 * @param {string} options.cigServiceUrl
 * @returns {Promise.<AccessTokenObject>}
 */
export function loginTestUser(options) {
  const clientId = options.clientId || process.env.WEBEX_CLIENT_ID;
  const clientSecret = options.clientSecret || process.env.WEBEX_CLIENT_SECRET;
  const cigServiceUrl =
    options.cigServiceUrl ||
    process.env.WEBEX_TEST_USERS_CI_GATEWAY_SERVICE_URL ||
    process.env.WEBEX_TEST_USERS_CONVERSATION_SERVICE_URL;

  if (!clientId) {
    throw new Error('options.clientId or process.env.WEBEX_CLIENT_ID must be defined');
  }

  if (!clientSecret) {
    throw new Error('options.clientSecret or process.env.WEBEX_CLIENT_SECRET must be defined');
  }

  if (!cigServiceUrl) {
    throw new Error(
      'options.cigServiceUrl or process.env.WEBEX_TEST_USERS_CI_GATEWAY_SERVICE_URL must be defined'
    );
  }

  return request({
    method: 'POST',
    uri: `${cigServiceUrl}${BASE_PATH}/login`,
    json: true,
    body: _.defaultsDeep(options, {
      clientId,
      clientSecret,
    }),
  }).then((res) => fixToken(res.body));
}

/**
 * Removes a test user
 * @param {Object} options
 * @param {string} options.id user id to remove
 * @param {string} options.cigServiceUrl
 * @param {Object} options.token
 * @param {string} options.token.authorization
 * @param {string} [options.token.refresh_token]
 * @returns {Promise}
 */
export function removeTestUser(options = {}) {
  const cigServiceUrl =
    options.cigServiceUrl ||
    process.env.WEBEX_TEST_USERS_CI_GATEWAY_SERVICE_URL ||
    process.env.WEBEX_TEST_USERS_CONVERSATION_SERVICE_URL;

  if (!cigServiceUrl) {
    throw new Error(
      'options.cigServiceUrl or process.env.WEBEX_TEST_USERS_CI_GATEWAY_SERVICE_URL must be defined'
    );
  }

  if (!options.id) {
    return Promise.reject(new Error('options.id is required'));
  }

  if (!options.token) {
    return loginTestUser(options).then((token) => {
      options.token = token;

      return removeTestUser(options);
    });
  }

  assert(options.token.authorization, 'options.token.authorization must be defined');

  return request({
    method: 'POST',
    json: true,
    headers: {
      authorization: options.token.authorization,
    },
    body: {
      /* eslint-disable camelcase */
      user_id: options.id,
      refresh_token: options.token.refresh_token,
      user_type: options.userType || 'PERSON',
      /* eslint-enable camelcase */
    },
    uri: `${cigServiceUrl}${BASE_PATH}/delete`,
  });
}

export {
  default as createWhistlerTestUser,
  removeTestUser as removeWhistlerTestUser,
} from './whistler';
