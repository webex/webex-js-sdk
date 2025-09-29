/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import querystring from 'querystring';
import url from 'url';

import jwt from 'jsonwebtoken';
import {whileInFlight, oneFlight, base64, tap} from '@webex/common';
import {safeSetTimeout} from '@webex/common-timers';
import {clone, cloneDeep, isObject, isEmpty} from 'lodash';

import WebexPlugin from '../webex-plugin';
import {persist, waitForValue} from '../storage/decorators';

import grantErrors, {OAuthError} from './grant-errors';
import {filterScope, diffScopes, sortScope} from './scope';
import Token from './token';
import TokenCollection from './token-collection';
import {METRICS} from '../constants';

export interface CredentialsState {
  supertoken?: Token;
  userTokens?: TokenCollection;
  isRefreshing?: boolean;
  ready?: boolean;
  refreshTimer?: any;
}

export interface BuildLoginUrlOptions {
  clientType?: 'public' | 'confidential';
  state?: any;
  client_id?: string;
  redirect_uri?: string;
  scope?: string;
  response_type?: string;
  [key: string]: any;
}

export interface GetClientTokenOptions {
  uri?: string;
  scope?: string;
}

/**
 * Credentials plugin for managing OAuth tokens and authentication
 */
export class Credentials extends WebexPlugin {
  namespace = 'Credentials';

  // Collections
  userTokens: TokenCollection;

  // State properties
  supertoken?: Token;
  isRefreshing = false;
  refreshTimer?: any;

  constructor(attrs: any = {}, options: any = {}) {
    super(attrs, options);

    // Initialize collections
    this.userTokens = new TokenCollection([], {parent: this});

    // Initialize from constructor similar to original
    this._initializeCredentials(attrs, options);
  }

  /**
   * Initialize credentials from various input formats
   * @private
   */
  private _initializeCredentials(attrs: any, options): void {
    if (attrs) {
      if (typeof attrs === 'string') {
        this.supertoken = new Token({access_token: attrs}, options);
      } else if (attrs.access_token) {
        this.supertoken = new Token(attrs, options);
      } else if (attrs.authorization) {
        if (attrs.authorization.supertoken) {
          this.supertoken = new Token(attrs.authorization.supertoken, options);
        } else {
          this.supertoken = new Token(attrs.authorization, options);
        }
      }

      // Schedule refresh if token has expiration
      if (this.supertoken && this.supertoken.get('expires')) {
        this.scheduleRefresh(this.supertoken.get('expires'));
      }
    }
  }

  // DERIVED PROPERTIES - equivalent to old ampersand derived properties
  // These replicate the exact logic from the original ampersand implementation

  /**
   * Indicates if this credentials instance can authorize requests
   * Equivalent to old ampersand derived.canAuthorize
   * @returns {boolean}
   */
  get canAuthorize(): boolean {
    return Boolean((this.supertoken && this.supertoken.canAuthorize) || this.canRefresh);
  }

  /**
   * Indicates if this credentials instance can refresh tokens
   * Equivalent to old ampersand derived.canRefresh
   * @returns {boolean}
   */
  get canRefresh(): boolean {
    // If we're operating in JWT mode, we have to delegate to the consumer
    if (this.config.jwtRefreshCallback) {
      return true;
    }

    return Boolean(this.supertoken && this.supertoken.canRefresh);
  }

  /**
   * Returns true if the user is an unverified guest
   * Equivalent to old ampersand derived.isUnverifiedGuest
   * @returns {boolean}
   */
  get isUnverifiedGuest(): boolean {
    if (!this.supertoken) {
      return false;
    }

    let isGuest = false;
    try {
      const accessToken = this.supertoken.get('access_token');
      if (accessToken) {
        const decoded = JSON.parse(base64.decode(accessToken.split('.')[1]));
        isGuest = decoded.user_type === 'guest';
      }
    } catch {
      /* the non-guest token is formatted differently so catch is expected */
    }

    return isGuest;
  }

  /**
   * Generates an OAuth Login URL. Prefers the api.ciscospark.com proxy if the
   * instance is initialize with an authorizatUrl, but fallsback to idbroker
   * as the base otherwise.
   * @param {BuildLoginUrlOptions} [options={}]
   * @returns {string}
   */
  buildLoginUrl(options: BuildLoginUrlOptions = {clientType: 'public'}): string {
    /* eslint-disable camelcase */
    if (options.state && !isObject(options.state)) {
      throw new Error('if specified, `options.state` must be an object');
    }

    const opts = cloneDeep(options);
    opts.client_id = this.config.client_id;
    opts.redirect_uri = this.config.redirect_uri;
    opts.scope = this.config.scope;

    if (!opts.response_type) {
      opts.response_type = opts.clientType === 'public' ? 'token' : 'code';
    }
    Reflect.deleteProperty(opts, 'clientType');

    if (opts.state) {
      if (!isEmpty(opts.state)) {
        opts.state = base64.toBase64Url(JSON.stringify(opts.state));
      } else {
        delete opts.state;
      }
    }

    return `${this.config.authorizeUrl}?${querystring.stringify(opts)}`;
    /* eslint-enable camelcase */
  }

  /**
   * Get the determined OrgId.
   *
   * @throws {Error} - If the OrgId could not be determined.
   * @returns {string} - The OrgId.
   */
  getOrgId(): string {
    this.logger.info('credentials: attempting to retrieve the OrgId from token');

    if (!this.supertoken) {
      throw new Error('No supertoken available to extract OrgId from');
    }

    try {
      // Attempt to extract a client-authenticated token's OrgId.
      this.logger.info('credentials: trying to extract OrgId from JWT');

      return this.extractOrgIdFromJWT(this.supertoken.get('access_token'));
    } catch (e) {
      // Attempt to extract a user token's OrgId.
      this.logger.info('credentials: could not extract OrgId from JWT');
      this.logger.info('credentials: attempting to extract OrgId from user token');

      try {
        return this.extractOrgIdFromUserToken(this.supertoken.get('access_token'));
      } catch (f) {
        this.logger.info('credentials: could not extract OrgId from user token');
        throw f;
      }
    }
  }

  /**
   * Extract the OrgId [realm] from a provided JWT.
   *
   * @private
   * @param {string} token - The JWT to extract the OrgId from.
   * @throws {Error} - If the token does not pass JWT general/realm validation.
   * @returns {string} - The OrgId.
   */
  private extractOrgIdFromJWT(token = ''): string {
    // Decoded the provided token.
    const decodedJWT = jwt.decode(token) as any;

    // Validate that the provided token is a JWT.
    if (!decodedJWT) {
      throw new Error('unable to extract the OrgId from the provided JWT');
    }

    if (!decodedJWT.realm) {
      throw new Error('the provided JWT does not contain an OrgId');
    }

    // Return the OrgId [realm].
    return decodedJWT.realm;
  }

  /**
   * Extract the OrgId [realm] from a provided user token.
   *
   * @private
   * @param {string} token - The user token to extract the OrgId from.
   * @throws {Error} - Will throw an error if the provided token is invalid.
   * @returns {string} - The OrgId.
   */
  private extractOrgIdFromUserToken(token = ''): string {
    // Split the provided token into subsections.
    const fields = token.split('_');

    // Validate that the provided token has the proper amount of sections.
    if (fields.length !== 3) {
      throw new Error(
        `the provided token is not a valid format, token has ${fields.length} sections`
      );
    }

    // Return the token section that contains the OrgId.
    return fields[2];
  }

  /**
   * Generates a Logout URL
   * @param {any} [options={}]
   * @returns {string}
   */
  buildLogoutUrl(options: any = {}): string {
    return `${this.config.logoutUrl}?${querystring.stringify({
      cisService: this.config.service,
      goto: this.config.redirect_uri,
      ...options,
    })}`;
  }

  /**
   * Generates a number between 60% - 90% of expired value
   * @param {number} expiration
   * @private
   * @returns {number}
   */
  private calcRefreshTimeout(expiration: number): number {
    return Math.floor(((Math.floor(Math.random() * 4) + 6) / 10) * expiration);
  }

  /**
   * Downscopes a token
   * @param {string} scope
   * @priv
   * @returns {Promise<Token>}
   */
  private downscope(scope: string): Promise<Token> {
    if (!this.supertoken) {
      return Promise.reject(new Error('No supertoken available for downscoping'));
    }

    return this.supertoken.downscope(scope).catch((reason: any) => {
      const failReason = reason?.body ?? reason;
      this.logger.warn(`credentials: failed to downscope supertoken to "${scope}"`, failReason);
      this.logger.trace(`credentials: falling back to supertoken for ${scope}`);
      this.webex.internal.metrics.submitClientMetrics(METRICS.JS_SDK_CREDENTIALS_DOWNSCOPE_FAILED, {
        fields: {
          requestedScope: scope,
          failReason,
        },
      });

      return Promise.resolve(new Token({scope, ...this.supertoken!.getState()}, {parent: this}));
    });
  }

  /**
   * Requests a client credentials grant and returns the token. Given the
   * limited use for such tokens as this time, this method does not cache its
   * token.
   * @param {GetClientTokenOptions} options
   * @returns {Promise<Token>}
   */
  getClientToken(options: GetClientTokenOptions = {}): Promise<Token> {
    this.logger.info('credentials: requesting client credentials grant');

    return this.webex
      .request({
        /* eslint-disable camelcase */
        method: 'POST',
        uri: options.uri || this.config.tokenUrl,
        form: {
          grant_type: 'client_credentials',
          scope: options.scope || 'webexsquare:admin',
          self_contained_token: true,
        },
        auth: {
          user: this.config.client_id,
          pass: this.config.client_secret,
          sendImmediately: true,
        },
        shouldRefreshAccessToken: false,
        /* eslint-enable camelcase */
      })
      .then((res: any) => new Token(res.body, {parent: this}))
      .catch((res: any) => {
        if (res.statusCode !== 400) {
          return Promise.reject(res);
        }

        const ErrorConstructor = grantErrors.select(res.body.error);

        return Promise.reject(new ErrorConstructor(res._res || res));
      });
  }

  /**
   * Resolves with a token with the specified scopes. If no scope is specified,
   * defaults to omit(webex.credentials.scope, 'spark:kms'). If no such token is
   * available, downscopes the supertoken to that scope.
   * @param {string} scope
   * @returns {Promise<Token>}
   */
  @oneFlight({keyFactory: (scope: string) => scope})
  @waitForValue('@')
  async getUserToken(scope?: string): Promise<Token> {
    // Wait for any in-flight token refresh to complete
    if (this.isRefreshing) {
      this.logger.info(
        'credentials: token refresh inflight; delaying getUserToken until refresh completes'
      );

      await new Promise<void>((resolve) => {
        this.once('change:isRefreshing', () => {
          this.logger.info('credentials: token refresh complete; reinvoking getUserToken');
          resolve();
        });
      });
    }

    // Check if we can authorize requests
    if (!this.canAuthorize) {
      this.logger.info('credentials: cannot produce an access token from current state');
      throw new Error('Current state cannot produce an access token');
    }

    // Determine scope if not provided
    if (!scope && this.supertoken) {
      scope = filterScope('spark:kms', this.supertoken.get('scope'));
    }
    scope = sortScope(scope);

    // Return supertoken if it matches the requested scope
    if (this.supertoken && scope === sortScope(this.supertoken.get('scope'))) {
      return this.supertoken;
    }

    // Check if we already have a token for this scope
    const existingToken = this.userTokens.get(scope);

    // Return existing token if it has an access_token (handles logout cleanup case)
    if (existingToken && existingToken.get('access_token')) {
      return existingToken;
    }

    // Downscope supertoken to create new user token
    const newToken = await this.downscope(scope);
    this.userTokens.add(newToken);

    return newToken;
  }

  /**
   * Initializer - equivalent to old ampersand initialize
   * This handles the config change listener setup like the original
   * @param {any} attrs
   * @param {any} options
   * @private
   */
  @persist('@')
  initialize(attrs?: any, options?: any): void {
    this.webex.on('change:config', () => {
      if (this.config.authorizationString) {
        const parsed = url.parse(this.config.authorizationString, true);

        /* eslint-disable camelcase */
        this.config.client_id = parsed.query.client_id;
        this.config.redirect_uri = parsed.query.redirect_uri;
        this.config.scope = parsed.query.scope;
        this.config.authorizeUrl = parsed.href.substr(0, parsed.href.indexOf('?'));
        /* eslint-enable camelcase */
      }
    });

    // The credentials plugin is ready immediately after initialization
    // The WebexCore will determine overall ready state by checking all plugin ready states
    this.ready = true;
  }

  /**
   * Clears all tokens from store them from the stores.
   *
   * This is no longer quite the right name for this method, but all of the
   * alternatives I'm coming up with are already taken.
   * @returns {Promise<void>}
   */
  @oneFlight
  @waitForValue('@')
  invalidate(): Promise<void> {
    this.logger.info('credentials: invalidating tokens');

    // clear refresh timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = undefined;
    }

    try {
      this.supertoken = undefined;
    } catch (err) {
      this.logger.warn('credentials: failed to clear supertoken', err);
    }

    while (this.userTokens.getModels().length) {
      try {
        this.userTokens.remove(this.userTokens.getModels()[0]);
      } catch (err) {
        this.logger.warn('credentials: failed to remove user token', err);
      }
    }

    this.logger.info('credentials: finished removing tokens');

    // Return a promise to give the storage layer a tick or two to clear
    // localStorage
    return Promise.resolve();
  }

  /**
   * Removes the supertoken and child tokens, then refreshes the supertoken;
   * subsequent calls to {@link Credentials#getUserToken()} will re-downscope
   * child tokens. Enqueus revocation of previous previousTokens. Yes, that's
   * the correct number of "previous"es.
   * @returns {Promise<void>}
   */
  @oneFlight
  @whileInFlight('isRefreshing')
  @waitForValue('@')
  refresh(): Promise<void> {
    this.logger.info('credentials: refresh requested');

    if (!this.supertoken) {
      return Promise.reject(new Error('No supertoken available for refresh'));
    }

    const {supertoken} = this;
    const tokens = clone(this.userTokens.getModels());

    // This is kind of a leaky abstraction, since it relies on the authorization
    // plugin, but the only alternatives I see are
    // 1. put all JWT support in core
    // 2. have separate jwt and non-jwt auth plugins
    // while I like #2 from a code simplicity standpoint, the third-party DX
    // isn't great
    if (this.config.jwtRefreshCallback) {
      return this.config
        .jwtRefreshCallback(this.webex)
        .then((jwtToken: string) =>
          this.webex.authorization.requestAccessTokenFromJwt({jwt: jwtToken})
        );
    }

    if (this.webex.internal.services) {
      this.webex.internal.services.updateCredentialsConfig();
    }

    return supertoken
      .refresh()
      .catch((error: any) => {
        if (error instanceof OAuthError) {
          // Error: super token refresh failed with 400 status code.
          // Hence emit an event to the client, an opportunity to logout.
          this.supertoken = undefined;
          while (this.userTokens.getModels().length) {
            try {
              this.userTokens.remove(this.userTokens.getModels()[0]);
            } catch (err) {
              this.logger.warn('credentials: failed to remove user token', err);
            }
          }
          this.webex.emit('client:InvalidRequestError');
        }

        return Promise.reject(error);
      })
      .then((st: Token) => {
        // clear refresh timer
        if (this.refreshTimer) {
          clearTimeout(this.refreshTimer);
          this.refreshTimer = undefined;
        }
        this.supertoken = st;

        const invalidScopes = diffScopes(this.config.scope, st.get('scope'));

        if (invalidScopes !== '') {
          this.logger.warn(
            `credentials: "${invalidScopes}" scope(s) are invalid because not listed in the supertoken, they will be excluded from user token requests.`
          );
          this.webex.internal.metrics.submitClientMetrics(
            METRICS.JS_SDK_CREDENTIALS_TOKEN_REFRESH_SCOPE_MISMATCH,
            {fields: {invalidScopes}}
          );
        }

        return Promise.all(
          tokens.map((token: Token) => {
            const tokenScope = filterScope(
              diffScopes(token.get('scope'), st.get('scope')),
              token.get('scope')
            );

            return this.downscope(tokenScope).then((t: Token) => {
              this.logger.info(`credentials: revoking token for ${token.get('scope')}`);

              return token
                .revoke()
                .catch((err: any) => {
                  this.logger.warn('credentials: failed to revoke user token', err);
                })
                .then(() => {
                  this.userTokens.remove(token.get('scope'));
                  this.userTokens.add(t);
                });
            });
          })
        );
      })
      .then(() => {
        if (this.supertoken) {
          this.scheduleRefresh(this.supertoken.get('expires'));
        }
      });
  }

  /**
   * Schedules a token refresh or refreshes the token if token has expired
   * @param {number} expires
   * @private
   * @returns {void}
   */
  private scheduleRefresh(expires: number): void {
    const expiresIn = expires - Date.now();

    if (expiresIn > 0) {
      const timeoutLength = this.calcRefreshTimeout(expiresIn);

      this.refreshTimer = safeSetTimeout(() => this.refresh(), timeoutLength);
    } else {
      this.refresh();
    }
  }
}

export default Credentials;
