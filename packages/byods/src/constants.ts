import os from 'os';

export const BYODS_FILE = 'BYODS';
export const BYODS_SDK_VERSION = '0.0.1';
export const BYODS_PACKAGE_NAME = 'BYoDS NodeJS SDK';
export const USER_AGENT = `${BYODS_PACKAGE_NAME}/(${os.type()}; ${os.platform()}; ${os.arch()}; Node.js/${
  process.version
})`;
export const PRODUCTION_BASE_URL = 'https://webexapis.com/v1';
export const INTEGRATION_BASE_URL = 'https://integration.webexapis.com/v1';
export const PRODUCTION_JWKS_URL = 'https://idbroker.webex.com/idb/oauth2/v2/keys/verificationjwk';
export const INTEGRATION_JWKS_URL =
  'https://idbrokerbts.webex.com/idb/oauth2/v2/keys/verificationjwk';
export const APPLICATION_ID_PREFIX = 'ciscospark://us/APPLICATION/';
export const BYODS_BASE_CLIENT_MODULE = 'base-client';
export const BYODS_MODULE = 'byods';
export const BYODS_TOKEN_MANAGER_MODULE = 'token-manager';
