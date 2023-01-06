import btoa from 'btoa';
import {request} from '@webex/http-core';

/**
 * Fetches credentials/access_token to talk to the whistler endpoint
 *
 * @param {Object} options
 * @param {string} options.clientId
 * @param {string} options.clientSecret
 * @param {string} options.idbrokerUrl
 * @param {string} options.orgId
 * @param {string} options.machineAccount
 * @param {string} options.machinePassword
 * @private
 * @returns {Promise<string>}
 */
const getClientCredentials = ({
  clientId,
  clientSecret,
  orgId,
  idbrokerUrl,
  machineAccount,
  machinePassword,
}) =>
  request({
    method: 'POST',
    uri: `${idbrokerUrl}/idb/token/${orgId}/v2/actions/GetBearerToken/invoke`,
    json: true,
    body: {
      uid: machineAccount,
      password: machinePassword,
    },
  })
    .then((res) =>
      request({
        method: 'POST',
        uri: `${idbrokerUrl}/idb/oauth2/v1/access_token`,
        json: true,
        form: {
          assertion: res.body.BearerToken,
          grant_type: 'urn:ietf:params:oauth:grant-type:saml2-bearer',
          scope: 'webexsquare:get_conversation webexsquare:admin',
          self_contained_token: true,
          client_id: clientId,
          client_secret: clientSecret,
        },
        headers: {
          // Note: we can't request's auth hash here because this endpoint expects
          // us to send the auth header *without including "Basic "* before the
          // token string
          // authorization: `Basic + ${btoa(`${clientId}:${clientSecret}`)}`
          authorization: btoa(`${clientId}:${clientSecret}`),
        },
      })
    )
    .then((res) => `${res.body.token_type} ${res.body.access_token}`);

/**
 * @typedef {Object} TestUserObject
 * @property {string} password
 * @property {string} emailAddress
 * @property {string} displayName
 * @property {string} token
 * @property {string} reservationUrl
 * @property {object} responseMetaData - whistler given properties
 */

/**
 * @typedef {Object} CreateUserOptions
 * @param {Object} [options]
 * @param {string} [whistlerServiceUrl] defaults to WHISTLER_API_SERVICE_URL
 * @param {string} [options.clientId] defaults to WEBEX_CLIENT_ID
 * @param {string} [options.clientSecret] defaults to WEBEX_CLIENT_SECRET
 * @param {string} [options.idbrokerUrl] defaults to IDBROKER_BASE_URL
 * @param {string} [options.orgId] organization ID to create the user under
 * @param {string} [options.machineAccount] defaults to WHISTLER_MACHINE_ACCOUNT
 * @param {string} [options.machinePassword] defaults to WHISTLER_MACHINE_PASSWORD
 */

/**
 * Creates a test user
 * @param {CreateUserOptions} options
 * @returns {Promise.<TestUserObject>}
 */
export default function createTestUser(options = {}) {
  const clientId = options.clientId || process.env.WEBEX_CLIENT_ID;
  const clientSecret = options.clientSecret || process.env.WEBEX_CLIENT_SECRET;
  const machineAccount = options.machineAccount || process.env.WHISTLER_MACHINE_ACCOUNT;
  const machinePassword = options.machinePassword || process.env.WHISTLER_MACHINE_PASSWORD;
  const idbrokerUrl = options.idbrokerUrl || process.env.IDBROKER_BASE_URL;
  const orgId = options.orgId || process.env.WHISTLER_TEST_ORG_ID;
  const whistlerServiceUrl = options.whistlerServiceUrl || process.env.WHISTLER_API_SERVICE_URL;
  const {reservationGroup, userScopes} = options;

  if (!clientId) {
    throw new Error('options.clientId or process.env.WEBEX_CLIENT_ID must be defined');
  }

  if (!clientSecret) {
    throw new Error('options.clientSecret or process.env.WEBEX_CLIENT_SECRET must be defined');
  }

  if (!machineAccount) {
    throw new Error(
      'options.machineAccount or process.env.WHISTLER_MACHINE_ACCOUNT must be defined'
    );
  }

  if (!machinePassword) {
    throw new Error(
      'options.machinePassword or process.env.WHISTLER_MACHINE_PASSWORD must be defined'
    );
  }
  if (!idbrokerUrl) {
    throw new Error('options.idbrokerUrl or process.env.IDBROKER_BASE_URL must be defined');
  }

  if (!orgId) {
    throw new Error('options.orgId or process.env.WHISTLER_TEST_ORG_ID must be defined');
  }

  if (!whistlerServiceUrl) {
    throw new Error(
      'options.whistlerServiceUrl or process.env.WHISTLER_API_SERVICE_URL must be defined'
    );
  }

  // For reservation groups and user scopes
  // Please check https://confluence-eng-gpk2.cisco.com/conf/pages/viewpage.action?spaceKey=LOCUS&title=Whistler+APIs#WhistlerAPIs-GET/reservations/testUser
  return getClientCredentials({
    clientId,
    clientSecret,
    machineAccount,
    machinePassword,
    idbrokerUrl,
    orgId,
  })
    .then((authorization) =>
      request({
        method: 'GET',
        uri: `${whistlerServiceUrl}/reservations/testUser`,
        qs: {
          reservationGroup,
          userScopes,
          isAccessTokenRequired: true,
        },
        headers: {
          authorization,
        },
      })
    )
    .then((res) => ({
      password: res.body.responseMetaData.ciPassword,
      emailAddress: res.body.responseMetaData.name,
      displayName: res.body.responseMetaData.webExUserName,
      token: res.body.responseMetaData.ciAccessToken,
      reservationUrl: res.body.reservationUrl,
      ...res.body.responseMetaData,
    }));
}

/**
 *
 * @param {Object} options
 * @returns {Promise}
 */
export function removeTestUser(options = {}) {
  return request({
    method: 'DELETE',
    headers: {
      authorization: `Bearer ${options.token}`,
    },
    uri: options.reservationUrl,
  });
}
