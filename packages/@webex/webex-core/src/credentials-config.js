import AmpState from 'ampersand-state';

// The credentials config which includes the CI server info and derived
// URL properties from them for the various CI services.  The URL's
// will be updated when the CI changes.
const CredentialsConfig = AmpState.extend({
  // we need to allow extra props for dynamic props like jwtRefreshCallback
  extraProperties: 'allow',

  props: {
    /**
     * The idbroker base host name
     * @returns {object}
     */
    idbroker: [
      'object',
      false,
      () => ({
        url: process.env.IDBROKER_BASE_URL || 'https://idbroker.webex.com',
      }),
    ],

    /**
     * The identity base host name
     * @returns {object}
     */
    identity: [
      'object',
      false,
      () => ({
        url: process.env.IDENTITY_BASE_URL || 'https://identity.webex.com',
      }),
    ],

    /**
     * This is the authorization url displayed on the
     * {@link developer portal|https://developer.webex.com}
     * @type {string}
     */
    authorizationString: [
      'string',
      false,
      process.env.WEBEX_AUTHORIZATION_STRING || process.env.AUTHORIZATION_STRING,
    ],

    /**
     * Authorization URL which prompts for user's password. Inferred from
     * {@link config.credentials.authorizationString}. This config value will
     * be automatically set if `authorizationString` config value is specified.
     *
     * @type {string}
     */
    authorizeUrl: [
      'string',
      false,
      process.env.WEBEX_AUTHORIZE_URL ||
        `${process.env.IDBROKER_BASE_URL || 'https://idbroker.webex.com'}/idb/oauth2/v1/authorize`,
    ],

    /**
     * {@see https://tools.ietf.org/html/rfc6749#section-4.1.4}
     * @type {string}
     */
    client_id: [
      'string',
      false,
      process.env.WEBEX_CLIENT_ID || process.env.COMMON_IDENTITY_CLIENT_ID || process.env.CLIENT_ID,
    ],

    /**
     * {@see https://tools.ietf.org/html/rfc6749#section-4.1.4}
     * @type {string}
     */
    client_secret: [
      'string',
      false,
      process.env.WEBEX_CLIENT_SECRET ||
        process.env.COMMON_IDENTITY_CLIENT_SECRET ||
        process.env.CLIENT_SECRET,
    ],

    /**
     * {@see https://tools.ietf.org/html/rfc6749#section-4.1.4}
     * @type {string}
     */
    redirect_uri: [
      'string',
      false,
      process.env.WEBEX_REDIRECT_URI ||
        process.env.COMMON_IDENTITY_REDIRECT_URI ||
        process.env.REDIRECT_URI,
    ],

    /**
     * {@see https://tools.ietf.org/html/rfc6749#section-4.1.4}
     * @type {string}
     */
    scope: [
      'string',
      false,
      process.env.WEBEX_SCOPE ||
        process.env.WEBEX_SCOPES ||
        process.env.COMMON_IDENTITY_SCOPE ||
        process.env.SCOPE,
    ],

    /**
     * Controls the UI of the CI login page.
     * @private
     * @type {string}
     */
    cisService: ['string', false, 'webex'],
  },

  derived: {
    /**
     * User activation URL
     * {@link config.credentials.activationUrl}
     * @type {string}
     */
    activationUrl: {
      deps: ['idbroker.url'],
      fn() {
        return `${
          this.idbroker.url || 'https://idbroker.webex.com'
        }/idb/token/v1/actions/UserActivation/invoke`;
      },
      cache: false,
    },

    /**
     * Generate OTP URL
     * {@link config.credentials.generateOtpUrl}
     * @type {string}
     */
    generateOtpUrl: {
      deps: ['idbroker.url'],
      fn() {
        return `${
          this.idbroker.url || 'https://idbroker.webex.com'
        }/idb/token/v1/actions/UserOTP/Generate/invoke`;
      },
      cache: false,
    },

    /**
     * Validate OTP URL
     * {@link config.credentials.validateOtpUrl}
     * @type {string}
     */
    validateOtpUrl: {
      deps: ['idbroker.url'],
      fn() {
        return `${
          this.idbroker.url || 'https://idbroker.webex.com'
        }/idb/token/v1/actions/UserOTP/Validate/invoke`;
      },
      cache: false,
    },

    // TODO does hydra also have an access_token endpoint?
    /**
     * Token URL used for token refresh and auth code exchange
     * @type {string}
     */
    tokenUrl: {
      deps: ['idbroker.url'],
      fn() {
        return process.env.TOKEN_URL || `${this.idbroker.url}/idb/oauth2/v1/access_token`;
      },
      cache: false,
    },

    /**
     * URL to revoke token
     * @type {string}
     */
    revokeUrl: {
      deps: ['idbroker.url'],
      fn() {
        return process.env.REVOKE_URL || `${this.idbroker.url}/idb/oauth2/v1/revoke`;
      },
      cache: false,
    },

    /**
     * URL to load when the app logs out
     * @type {string}
     */
    logoutUrl: {
      deps: ['idbroker.url'],
      fn() {
        return `${this.idbroker.url}/idb/oauth2/v1/logout`;
      },
      cache: false,
    },

    /**
     * Set password URL
     * @type {string}
     */
    setPasswordUrl: {
      deps: ['identity.url'],
      fn() {
        return `${this.identity.url || 'https://identity.webex.com'}/identity/scim/v1/Users`;
      },
      cache: false,
    },
  },
});

export default CredentialsConfig;
