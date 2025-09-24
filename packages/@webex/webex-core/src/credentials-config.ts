/**
 * Service configuration interface
 */
interface ServiceConfig {
  url: string;
}

/**
 * Interface for credentials configuration
 */
interface CredentialsConfigInterface {
  idbroker?: ServiceConfig;
  identity?: ServiceConfig;
  authorizationString?: string;
  authorizeUrl?: string;
  client_id?: string;
  client_secret?: string;
  redirect_uri?: string;
  scope?: string;
  cisService?: string;
  jwtRefreshCallback?: (...args: any[]) => any;
  [key: string]: any; // Allow extra properties for dynamic props
}

// The credentials config which includes the CI server info and derived
// URL properties from them for the various CI services.  The URL's
// will be updated when the CI changes.
class CredentialsConfig {
  /**
   * The idbroker base host name
   * @type {ServiceConfig}
   */
  public idbroker: ServiceConfig;

  /**
   * The identity base host name
   * @type {ServiceConfig}
   */
  public identity: ServiceConfig;

  /**
   * This is the authorization url displayed on the
   * {@link developer portal|https://developer.webex.com}
   * @type {string}
   */
  public authorizationString?: string;

  /**
   * Authorization URL which prompts for user's password. Inferred from
   * {@link config.credentials.authorizationString}. This config value will
   * be automatically set if `authorizationString` config value is specified.
   * @type {string}
   */
  public authorizeUrl?: string;

  /**
   * {@see https://tools.ietf.org/html/rfc6749#section-4.1.4}
   * @type {string}
   */
  public client_id?: string;

  /**
   * {@see https://tools.ietf.org/html/rfc6749#section-4.1.4}
   * @type {string}
   */
  public client_secret?: string;

  /**
   * {@see https://tools.ietf.org/html/rfc6749#section-4.1.4}
   * @type {string}
   */
  public redirect_uri?: string;

  /**
   * {@see https://tools.ietf.org/html/rfc6749#section-4.1.4}
   * @type {string}
   */
  public scope?: string;

  /**
   * Controls the UI of the CI login page.
   * @private
   * @type {string}
   */
  public cisService: string;

  // Allow extra properties for dynamic props like jwtRefreshCallback
  [key: string]: any;

  /**
   * Constructor for CredentialsConfig
   * @param {CredentialsConfigInterface} attrs - Initial configuration attributes
   */
  constructor(attrs: CredentialsConfigInterface = {}) {
    // Initialize default values
    this.idbroker = attrs.idbroker || {
      url: process.env.IDBROKER_BASE_URL || 'https://idbroker.webex.com',
    };

    this.identity = attrs.identity || {
      url: process.env.IDENTITY_BASE_URL || 'https://identity.webex.com',
    };

    this.authorizationString =
      attrs.authorizationString ||
      process.env.WEBEX_AUTHORIZATION_STRING ||
      process.env.AUTHORIZATION_STRING;

    this.authorizeUrl =
      attrs.authorizeUrl ||
      process.env.WEBEX_AUTHORIZE_URL ||
      `${process.env.IDBROKER_BASE_URL || 'https://idbroker.webex.com'}/idb/oauth2/v1/authorize`;

    this.client_id =
      attrs.client_id ||
      process.env.WEBEX_CLIENT_ID ||
      process.env.COMMON_IDENTITY_CLIENT_ID ||
      process.env.CLIENT_ID;

    this.client_secret =
      attrs.client_secret ||
      process.env.WEBEX_CLIENT_SECRET ||
      process.env.COMMON_IDENTITY_CLIENT_SECRET ||
      process.env.CLIENT_SECRET;

    this.redirect_uri =
      attrs.redirect_uri ||
      process.env.WEBEX_REDIRECT_URI ||
      process.env.COMMON_IDENTITY_REDIRECT_URI ||
      process.env.REDIRECT_URI;

    this.scope =
      attrs.scope ||
      process.env.WEBEX_SCOPE ||
      process.env.WEBEX_SCOPES ||
      process.env.COMMON_IDENTITY_SCOPE ||
      process.env.SCOPE;

    this.cisService = attrs.cisService || 'webex';

    // Set any extra properties
    Object.keys(attrs).forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(this, key)) {
        this[key] = attrs[key];
      }
    });
  }

  /**
   * User activation URL
   * {@link config.credentials.activationUrl}
   * @type {string}
   */
  get activationUrl(): string {
    return `${
      this.idbroker.url || 'https://idbroker.webex.com'
    }/idb/token/v1/actions/UserActivation/invoke`;
  }

  /**
   * Generate OTP URL
   * {@link config.credentials.generateOtpUrl}
   * @type {string}
   */
  get generateOtpUrl(): string {
    return `${
      this.idbroker.url || 'https://idbroker.webex.com'
    }/idb/token/v1/actions/UserOTP/Generate/invoke`;
  }

  /**
   * Validate OTP URL
   * {@link config.credentials.validateOtpUrl}
   * @type {string}
   */
  get validateOtpUrl(): string {
    return `${
      this.idbroker.url || 'https://idbroker.webex.com'
    }/idb/token/v1/actions/UserOTP/Validate/invoke`;
  }

  /**
   * Token URL used for token refresh and auth code exchange
   * @type {string}
   */
  get tokenUrl(): string {
    return process.env.TOKEN_URL || `${this.idbroker.url}/idb/oauth2/v1/access_token`;
  }

  /**
   * URL to revoke token
   * @type {string}
   */
  get revokeUrl(): string {
    return process.env.REVOKE_URL || `${this.idbroker.url}/idb/oauth2/v1/revoke`;
  }

  /**
   * URL to load when the app logs out
   * @type {string}
   */
  get logoutUrl(): string {
    return `${this.idbroker.url}/idb/oauth2/v1/logout`;
  }

  /**
   * Set password URL
   * @type {string}
   */
  get setPasswordUrl(): string {
    return `${this.identity.url || 'https://identity.webex.com'}/identity/scim/v1/Users`;
  }
}

export default CredentialsConfig;
