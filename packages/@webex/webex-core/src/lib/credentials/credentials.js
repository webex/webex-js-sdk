/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import querystring from 'querystring';
import url from 'url';

import jwt from 'jsonwebtoken';
import {base64, makeStateDataType, oneFlight, tap, whileInFlight} from '@webex/common';
import {safeSetTimeout} from '@webex/common-timers';
import {clone, cloneDeep, isObject, isEmpty} from 'lodash';

import WebexPlugin from '../webex-plugin';
import {persist, waitForValue} from '../storage/decorators';

import grantErrors from './grant-errors';
import {filterScope, sortScope} from './scope';
import Token from './token';
import TokenCollection from './token-collection';

/**
 * @class
 */
const Credentials = WebexPlugin.extend({
  collections: {
    userTokens: TokenCollection,
  },

  dataTypes: {
    token: makeStateDataType(Token, 'token').dataType,
  },

  derived: {
    canAuthorize: {
      deps: ['supertoken', 'supertoken.canAuthorize', 'canRefresh'],
      fn() {
        return Boolean((this.supertoken && this.supertoken.canAuthorize) || this.canRefresh);
      },
    },
    canRefresh: {
      deps: ['supertoken', 'supertoken.canRefresh'],
      fn() {
        // If we're operating in JWT mode, we have to delegate to the consumer
        if (this.config.jwtRefreshCallback) {
          return true;
        }

        return Boolean(this.supertoken && this.supertoken.canRefresh);
      },
    },
  },

  props: {
    supertoken: makeStateDataType(Token, 'token').prop,
  },

  namespace: 'Credentials',

  session: {
    isRefreshing: {
      default: false,
      type: 'boolean',
    },
    /**
     * Becomes `true` once the {@link loaded} event fires.
     * @see {@link WebexPlugin#ready}
     * @instance
     * @memberof Credentials
     * @type {boolean}
     */
    ready: {
      default: false,
      type: 'boolean',
    },
    refreshTimer: {
      default: undefined,
      type: 'any',
    },
  },

  /**
   * Generates an OAuth Login URL. Prefers the api.ciscospark.com proxy if the
   * instance is initialize with an authorizatUrl, but fallsback to idbroker
   * as the base otherwise.
   * @instance
   * @memberof Credentials
   * @param {Object} [options={}]
   * @returns {string}
   */
  buildLoginUrl(options = {clientType: 'public'}) {
    /* eslint-disable camelcase */
    if (options.state && !isObject(options.state)) {
      throw new Error('if specified, `options.state` must be an object');
    }

    options.client_id = this.config.client_id;
    options.redirect_uri = this.config.redirect_uri;
    options.scope = this.config.scope;

    options = cloneDeep(options);

    if (!options.response_type) {
      options.response_type = options.clientType === 'public' ? 'token' : 'code';
    }
    Reflect.deleteProperty(options, 'clientType');

    if (options.state) {
      if (!isEmpty(options.state)) {
        options.state = base64.toBase64Url(JSON.stringify(options.state));
      } else {
        delete options.state;
      }
    }

    return `${this.config.authorizeUrl}?${querystring.stringify(options)}`;
    /* eslint-enable camelcase */
  },

  /**
   * Get the determined OrgId.
   *
   * @throws {Error} - If the OrgId could not be determined.
   * @returns {string} - The OrgId.
   */
  getOrgId() {
    this.logger.info('credentials: attempting to retrieve the OrgId from token');

    try {
      // Attempt to extract a client-authenticated token's OrgId.
      this.logger.info('credentials: trying to extract OrgId from JWT');

      return this.extractOrgIdFromJWT(this.supertoken.access_token);
    } catch (e) {
      // Attempt to extract a user token's OrgId.
      this.logger.info('credentials: could not extract OrgId from JWT');
      this.logger.info('credentials: attempting to extract OrgId from user token');

      try {
        return this.extractOrgIdFromUserToken(this.supertoken?.access_token);
      } catch (f) {
        this.logger.info('credentials: could not extract OrgId from user token');
        throw f;
      }
    }
  },

  /**
   * Extract the OrgId [realm] from a provided JWT.
   *
   * @private
   * @param {string} token - The JWT to extract the OrgId from.
   * @throws {Error} - If the token does not pass JWT general/realm validation.
   * @returns {string} - The OrgId.
   */
  extractOrgIdFromJWT(token = '') {
    // Decoded the provided token.
    const decodedJWT = jwt.decode(token);

    // Validate that the provided token is a JWT.
    if (!decodedJWT) {
      throw new Error('unable to extract the OrgId from the provided JWT');
    }

    if (!decodedJWT.realm) {
      throw new Error('the provided JWT does not contain an OrgId');
    }

    // Return the OrgId [realm].
    return decodedJWT.realm;
  },

  /**
   * Extract the OrgId [realm] from a provided user token.
   *
   * @private
   * @param {string} token - The user token to extract the OrgId from.
   * @throws {Error} - Will throw an error if the provided token is invalid.
   * @returns {string} - The OrgId.
   */
  extractOrgIdFromUserToken(token = '') {
    // Split the provided token into subsections.
    const fields = token.split('_');

    // Validate that the provided token has the proper amount of sections.
    if (fields.length !== 3) {
      throw new Error('the provided token is not a valid format');
    }

    // Return the token section that contains the OrgId.
    return fields[2];
  },

  /**
   * Generates a Logout URL
   * @instance
   * @memberof Credentials
   * @param {Object} [options={}]
   * @returns {[type]}
   */
  buildLogoutUrl(options = {}) {
    return `${this.config.logoutUrl}?${querystring.stringify({
      cisService: this.config.service,
      goto: this.config.redirect_uri,
      ...options,
    })}`;
  },

  /**
   * Generates a number between 60% - 90% of expired value
   * @instance
   * @memberof Credentials
   * @param {number} expiration
   * @private
   * @returns {number}
   */
  calcRefreshTimeout(expiration) {
    return Math.floor(((Math.floor(Math.random() * 4) + 6) / 10) * expiration);
  },

  constructor(...args) {
    // HACK to deal with the fact that AmpersandState#dataTypes#set is a pure
    // function.
    this._dataTypes = cloneDeep(this._dataTypes);
    Object.keys(this._dataTypes).forEach((key) => {
      if (this._dataTypes[key].set) {
        this._dataTypes[key].set = this._dataTypes[key].set.bind(this);
      }
    });
    // END HACK
    Reflect.apply(WebexPlugin, this, args);
  },

  /**
   * Downscopes a token
   * @instance
   * @memberof Credentials
   * @param {string} scope
   * @private
   * @returns {Promise<Token>}
   */
  downscope(scope) {
    return this.supertoken.downscope(scope).catch((reason) => {
      this.logger.trace(`credentials: failed to downscope supertoken to ${scope}`, reason);
      this.logger.trace(`credentials: falling back to supertoken for ${scope}`);

      return Promise.resolve(new Token({scope, ...this.supertoken.serialize()}), {
        parent: this,
      });
    });
  },

  /**
   * Requests a client credentials grant and returns the token. Given the
   * limited use for such tokens as this time, this method does not cache its
   * token.
   * @instance
   * @memberof Credentials
   * @param {Object} options
   * @returns {Promise<Token>}
   */
  getClientToken(options = {}) {
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
      .then((res) => new Token(res.body, {parent: this}))
      .catch((res) => {
        if (res.statusCode !== 400) {
          return Promise.reject(res);
        }

        const ErrorConstructor = grantErrors.select(res.body.error);

        return Promise.reject(new ErrorConstructor(res._res || res));
      });
  },

  @oneFlight({keyFactory: (scope) => scope})
  @waitForValue('@')
  /**
   * Resolves with a token with the specified scopes. If no scope is specified,
   * defaults to omit(webex.credentials.scope, 'spark:kms'). If no such token is
   * available, downscopes the supertoken to that scope.
   * @instance
   * @memberof Credentials
   * @param {string} scope
   * @returns {Promise<Token>}
   */
  getUserToken(scope) {
    return Promise.resolve(
      !this.isRefreshing ||
        new Promise((resolve) => {
          this.logger.info(
            'credentials: token refresh inflight; delaying getUserToken until refresh completes'
          );
          this.once('change:isRefreshing', () => {
            this.logger.info('credentials: token refresh complete; reinvoking getUserToken');
            resolve();
          });
        })
    ).then(() => {
      if (!this.canAuthorize) {
        this.logger.info('credentials: cannot produce an access token from current state');

        return Promise.reject(new Error('Current state cannot produce an access token'));
      }

      if (!scope) {
        scope = filterScope('spark:kms', this.config.scope);
      }

      scope = sortScope(scope);

      if (scope === sortScope(this.config.scope)) {
        return Promise.resolve(this.supertoken);
      }

      const token = this.userTokens.get(scope);

      // we should also check for the token.access_token since token object does
      // not get cleared on unsetting while logging out.
      if (!token || !token.access_token) {
        return this.downscope(scope).then(tap((t) => this.userTokens.add(t)));
      }

      return Promise.resolve(token);
    });
  },

  @persist('@')
  /**
   * Initializer
   * @instance
   * @memberof Credentials
   * @param {Object} attrs
   * @param {Object} options
   * @private
   * @returns {Credentials}
   */
  initialize(attrs, options) {
    if (attrs) {
      if (typeof attrs === 'string') {
        this.supertoken = attrs;
      }

      if (attrs.access_token) {
        this.supertoken = attrs;
      }

      if (attrs.authorization) {
        if (attrs.authorization.supertoken) {
          this.supertoken = attrs.authorization.supertoken;
        } else {
          this.supertoken = attrs.authorization;
        }
      }

      // schedule refresh
      if (this.supertoken && this.supertoken.expires) {
        this.scheduleRefresh(this.supertoken.expires);
      }
    }

    Reflect.apply(WebexPlugin.prototype.initialize, this, [attrs, options]);

    this.listenToOnce(this.parent, 'change:config', () => {
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

    this.webex.once('loaded', () => {
      this.ready = true;
    });
  },

  @oneFlight
  @waitForValue('@')
  /**
   * Clears all tokens from store them from the stores.
   *
   * This is no longer quite the right name for this method, but all of the
   * alternatives I'm coming up with are already taken.
   * @instance
   * @memberof Credentials
   * @returns {Promise}
   */
  invalidate() {
    this.logger.info('credentials: invalidating tokens');

    // clear refresh timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.unset('refreshTimer');
    }

    try {
      this.unset('supertoken');
    } catch (err) {
      this.logger.warn('credentials: failed to clear supertoken', err);
    }

    while (this.userTokens.models.length) {
      try {
        this.userTokens.remove(this.userTokens.models[0]);
      } catch (err) {
        this.logger.warn('credentials: failed to remove user token', err);
      }
    }

    this.logger.info('credentials: finished removing tokens');

    // Return a promise to give the storage layer a tick or two to clear
    // localStorage
    return Promise.resolve();
  },

  @oneFlight
  @whileInFlight('isRefreshing')
  @waitForValue('@')
  /**
   * Removes the supertoken and child tokens, then refreshes the supertoken;
   * subsequent calls to {@link Credentials#getUserToken()} will re-downscope
   * child tokens. Enqueus revocation of previous previousTokens. Yes, that's
   * the correct number of "previous"es.
   * @instance
   * @memberof Credentials
   * @returns {Promise}
   */
  refresh() {
    this.logger.info('credentials: refresh requested');

    const {supertoken} = this;
    const tokens = clone(this.userTokens.models);

    // This is kind of a leaky abstraction, since it relies on the authorization
    // plugin, but the only alternatives I see are
    // 1. put all JWT support in core
    // 2. have separate jwt and non-jwt auth plugins
    // while I like #2 from a code simplicity standpoint, the third-party DX
    // isn't great
    if (this.config.jwtRefreshCallback) {
      return (
        this.config
          .jwtRefreshCallback(this.webex)
          // eslint-disable-next-line no-shadow
          .then((jwt) => this.webex.authorization.requestAccessTokenFromJwt({jwt}))
      );
    }

    if (this.webex.internal.services) {
      this.webex.internal.services.updateCredentialsConfig();
    }

    return supertoken
      .refresh()
      .then((st) => {
        // clear refresh timer
        if (this.refreshTimer) {
          clearTimeout(this.refreshTimer);
          this.unset('refreshTimer');
        }
        this.supertoken = st;

        return Promise.all(
          tokens.map((token) =>
            this.downscope(token.scope)
              // eslint-disable-next-line max-nested-callbacks
              .then((t) => {
                this.logger.info(`credentials: revoking token for ${token.scope}`);

                return token
                  .revoke()
                  .catch((err) => {
                    this.logger.warn('credentials: failed to revoke user token', err);
                  })
                  .then(() => {
                    this.userTokens.remove(token.scope);
                    this.userTokens.add(t);
                  });
              })
          )
        );
      })
      .then(() => {
        this.scheduleRefresh(this.supertoken.expires);
      })
      .catch((error) => {
        const {InvalidRequestError} = grantErrors;

        if (error instanceof InvalidRequestError) {
          // Error: The refresh token provided is expired, revoked, malformed, or invalid. Hence emit an event to the client, an opportunity to logout.
          this.unset('supertoken');
          while (this.userTokens.models.length) {
            try {
              this.userTokens.remove(this.userTokens.models[0]);
            } catch (err) {
              this.logger.warn('credentials: failed to remove user token', err);
            }
          }
          this.webex.trigger('client:InvalidRequestError');
        }

        return Promise.reject(error);
      });
  },

  /**
   * Schedules a token refresh or refreshes the token if token has expired
   * @instance
   * @memberof Credentials
   * @param {number} expires
   * @private
   * @returns {undefined}
   */
  scheduleRefresh(expires) {
    const expiresIn = expires - Date.now();

    if (expiresIn > 0) {
      const timeoutLength = this.calcRefreshTimeout(expiresIn);

      this.refreshTimer = safeSetTimeout(() => this.refresh(), timeoutLength);
    } else {
      this.refresh();
    }
  },
});

export default Credentials;
