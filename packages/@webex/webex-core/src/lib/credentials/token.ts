/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {pick} from 'lodash';
import {inBrowser, oneFlight} from '@webex/common';
import {safeSetTimeout} from '@webex/common-timers';

import WebexHttpError from '../webex-http-error';
import WebexPlugin from '../webex-plugin';

import {sortScope, diffScopes} from './scope';
import grantErrors, {OAuthError} from './grant-errors';

/* eslint-disable camelcase */

/**
 * Parse response from CI and converts to structured error when appropriate
 * @param {WebexHttpError} res
 * @private
 * @returns {GrantError}
 */
function processGrantError(res: any) {
  if (res.statusCode !== 400) {
    return Promise.reject(res);
  }

  const ErrorConstructor = grantErrors.select(res.body.error);

  if (ErrorConstructor === OAuthError && res instanceof WebexHttpError) {
    return Promise.reject(res);
  }
  if (!ErrorConstructor) {
    return Promise.reject(res);
  }

  return Promise.reject(new ErrorConstructor(res._res || res));
}

export interface TokenState {
  scope?: string;
  access_token?: string;
  expires?: number;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires?: number;
  refresh_token_expires_in?: number;
  token_type?: string;
  _isExpired?: boolean;
  previousToken?: Token;
}

/**
 * Token class for managing OAuth tokens
 */
export class Token extends WebexPlugin {
  namespace = 'Credentials';

  constructor(attrs: TokenState | string = {}, options: any = {}) {
    super(attrs as TokenState, options);

    // Handle string input (access_token directly)
    if (typeof attrs === 'string') {
      this.set('access_token', attrs);
    } else if (attrs) {
      // Handle object input - set all properties
      this.set(attrs);
    }

    if (!(this as any).get('access_token')) {
      throw new Error('`access_token` is required');
    }

    // Set default token_type
    if (!(this as any).get('token_type')) {
      (this as any).set('token_type', 'Bearer');
    }

    // We don't want the derived property `isExpired` to need {cache:false}, so
    // we'll set up a timer that runs when this token should expire.
    if ((this as any).get('expires')) {
      if ((this as any).get('expires') < Date.now()) {
        (this as any).set('_isExpired', true);
      } else {
        safeSetTimeout(() => {
          (this as any).set('_isExpired', true);
        }, (this as any).get('expires') - Date.now());
      }
    }
  }

  /**
   * Unset properties from the token
   * @param {string | string[]} keys - Property key(s) to unset
   */
  unset(keys: string | string[]): void {
    const keysArray = Array.isArray(keys) ? keys : [keys];
    keysArray.forEach((key) => {
      (this as any).set(key, undefined);
    });
  }

  /**
   * Filter and process set parameters (similar to ampstate _filterSetParameters)
   * @param {...any} args - Arguments to filter
   * @returns {[any, any]} Filtered attributes and options
   */
  _filterSetParameters(...args: any[]): [any, any] {
    let attrs = {};
    let options = {};

    if (args.length === 1) {
      if (typeof args[0] === 'string') {
        // Single string argument - not supported in this context
        throw new Error('Single string argument not supported in set()');
      } else {
        attrs = args[0] || {};
      }
    } else if (args.length === 2) {
      if (typeof args[0] === 'string') {
        // Key-value pair
        attrs = {[args[0]]: args[1]};
      } else {
        attrs = args[0] || {};
        options = args[1] || {};
      }
    }

    return [attrs, options];
  }

  /**
   * Indicates if this token can be used in an auth header. `true` iff
   * access_token is defined and isExpired is false.
   * @returns {boolean}
   */
  get canAuthorize(): boolean {
    return !!(this as any).get('access_token') && !this.isExpired;
  }

  /**
   * Indicates that this token can be downscoped. `true` iff
   * config.credentials.client_id is defined and if canAuthorize is true
   * @returns {boolean}
   */
  get canDownscope(): boolean {
    return this.canAuthorize && !!this.config.client_id;
  }

  /**
   * Indicates if this token can be refreshed. `true` iff
   * refresh_token is defined and config.credentials.refreshCallback() is defined
   * @returns {boolean}
   */
  get canRefresh(): boolean {
    if (inBrowser) {
      return !!(this as any).get('refresh_token') && !!this.config.refreshCallback;
    }

    return !!(this as any).get('refresh_token') && !!this.config.client_secret;
  }

  /**
   * Indicates if this `Token` is expired. `true` iff expires is
   * defined and is less than Date.now().
   * @returns {boolean}
   */
  get isExpired(): boolean {
    // in order to avoid setting `cache:false`, we'll use a private property
    // and a timer rather than comparing to `Date.now()`;
    return !!(this as any).get('expires') && (this as any).get('_isExpired');
  }

  /**
   * Cache for toString()
   * @returns {string}
   */
  private get _string(): string {
    if (!(this as any).get('access_token') || !(this as any).get('token_type')) {
      return '';
    }

    return `${(this as any).get('token_type')} ${(this as any).get('access_token')}`;
  }

  /**
   * Uses this token to request a new Token with a subset of this Token's scopes
   * @param {string} scope
   * @returns {Promise<Token>}
   */
  @oneFlight({
    keyFactory(scope: string) {
      return scope;
    },
  })
  downscope(scope: string): Promise<Token> {
    this.logger.info(`token: downscoping token to ${scope}`);

    if (this.isExpired) {
      this.logger.info('token: request received to downscope expired access_token');

      return Promise.reject(new Error('cannot downscope expired access token'));
    }

    if (!this.canDownscope) {
      if (this.config.client_id) {
        this.logger.info('token: request received to downscope invalid access_token');
      } else {
        this.logger.trace('token: cannot downscope without client_id');
      }

      return Promise.reject(new Error('cannot downscope access token'));
    }

    if (diffScopes(scope, this.config.scope) !== '') {
      return Promise.reject(
        new Error(
          `new scope (${scope}) is not subset of the available scopes (${this.config.scope})`
        )
      );
    }

    // Since we're going to use scope as the index in our token collection, it's
    // important scopes are always deterministically specified.
    if (scope) {
      scope = sortScope(scope);
    }

    // Ideally, we could depend on the service to communicate this error, but
    // all we get is "invalid scope", which, to the lay person, implies
    // something wrong with *one* of the scopes, not the whole thing.
    if (scope === sortScope(this.config.scope)) {
      return Promise.reject(new Error('token: scope reduction requires a reduced scope'));
    }

    return this.webex
      .request({
        method: 'POST',
        uri: this.config.tokenUrl,
        addAuthHeader: false,
        form: {
          grant_type: 'urn:cisco:oauth:grant-type:scope-reduction',
          token: (this as any).get('access_token'),
          scope,
          client_id: this.config.client_id,
          self_contained_token: true,
        },
      })
      .then((res: any) => {
        this.logger.info(`token: downscoped token to ${scope}`);

        return new Token(Object.assign(res.body, {scope}), {parent: this.parent});
      });
  }

  /**
   * Refreshes this Token. Relies on config.credentials.refreshCallback()
   * @returns {Promise<Token>}
   */
  @oneFlight
  refresh(): Promise<Token> {
    if (!this.canRefresh) {
      throw new Error('Not enough information available to refresh this access token');
    }

    let promise: Promise<any> | undefined;

    if (inBrowser) {
      if (!this.config.refreshCallback) {
        throw new Error('Cannot refresh access token without refreshCallback');
      }

      promise = Promise.resolve(this.config.refreshCallback(this.webex, this));
    }

    return (
      promise ||
      this.webex
        .request({
          method: 'POST',
          uri: this.config.tokenUrl,
          form: {
            grant_type: 'refresh_token',
            redirect_uri: this.config.redirect_uri,
            refresh_token: (this as any).get('refresh_token'),
          },
          auth: {
            user: this.config.client_id,
            pass: this.config.client_secret,
            sendImmediately: true,
          },
          shouldRefreshAccessToken: false,
        })
        .then((res: any) => res.body)
    )
      .then((obj: any) => {
        if (!obj) {
          throw new Error('token: refreshCallback() did not produce an object');
        }
        // If the authentication server did not send back a refresh token, copy
        // the current refresh token and related values to the response (note:
        // at time of implementation, CI never sends a new refresh token)
        if (!obj.refresh_token) {
          Object.assign(
            obj,
            pick(
              (this as any).getState(),
              'refresh_token',
              'refresh_token_expires',
              'refresh_token_expires_in'
            )
          );
        }

        // If the new token is the same as the previous token, then we may have
        // found a bug in CI; log the details and reject the Promise
        if ((this as any).get('access_token') === obj.access_token) {
          this.logger.error('token: new token matches current token');
          // log the tokens if it is not production
          if (process.env.NODE_ENV !== 'production') {
            this.logger.error('token: current token:', (this as any).get('access_token'));
            this.logger.error('token: new token:', obj.access_token);
          }

          return Promise.reject(new Error('new token matches current token'));
        }

        if ((this as any).get('previousToken')) {
          ((this as any).get('previousToken') as Token).revoke();
          (this as any).set('previousToken', undefined);
        }

        obj.previousToken = this;
        obj.scope = (this as any).get('scope');

        return new Token(obj, {parent: this.parent});
      })
      .catch(processGrantError);
  }

  /**
   * Revokes this token and unsets its local properties
   * @returns {Promise}
   */
  @oneFlight
  revoke(): Promise<void> {
    if (this.isExpired) {
      this.logger.info('token: already expired, not making making revocation request');

      return Promise.resolve();
    }

    if (!this.canAuthorize) {
      this.logger.info('token: no longer valid, not making revocation request');

      return Promise.resolve();
    }

    // FIXME we need to use the user token revocation endpoint to revoke a token
    // without a client_secret, but it doesn't current support using a token to
    // revoke itself
    // Note: I'm not making a canRevoke property because there should be changes
    // coming to the user token revocation endpoint that allow us to do this
    // correctly.
    if (!this.config.client_secret) {
      this.logger.info('token: no client secret available, not making revocation request');

      return Promise.resolve();
    }

    this.logger.info('token: revoking access token');

    return this.webex
      .request({
        method: 'POST',
        uri: this.config.revokeUrl,
        form: {
          token: (this as any).get('access_token'),
          token_type_hint: 'access_token',
        },
        auth: {
          user: this.config.client_id,
          pass: this.config.client_secret,
          sendImmediately: true,
        },
        shouldRefreshAccessToken: false,
      })
      .then(() => {
        (this as any).set('access_token', undefined);
        (this as any).set('expires', undefined);
        (this as any).set('expires_in', undefined);
        (this as any).set('token_type', undefined);
        this.logger.info('token: access token revoked');
      })
      .catch(processGrantError);
  }

  /**
   * Override set method to handle token parsing and expiration calculation
   */
  set(key: string, value: any): void;
  set(attrs: Partial<TokenState>): void;
  set(keyOrAttrs: string | Partial<TokenState>, value?: any): void {
    let attrs: Partial<TokenState>;

    if (typeof keyOrAttrs === 'string') {
      attrs = {[keyOrAttrs]: value};
    } else {
      attrs = keyOrAttrs;
    }

    if (!attrs.token_type && attrs.access_token && attrs.access_token.includes(' ')) {
      const [token_type, access_token] = attrs.access_token.split(' ');

      attrs = {...attrs, access_token, token_type};
    }

    const now = Date.now();

    if (!attrs.expires && attrs.expires_in) {
      attrs.expires = now + attrs.expires_in * 1000;
    }

    if (!attrs.refresh_token_expires && attrs.refresh_token_expires_in) {
      attrs.refresh_token_expires = now + attrs.refresh_token_expires_in * 1000;
    }

    if (attrs.scope) {
      attrs.scope = sortScope(attrs.scope);
    }

    // Call parent set method for each property
    Object.keys(attrs).forEach((key) => {
      super.set(key, attrs[key as keyof TokenState]);
    });
  }

  /**
   * Renders the token object as an HTTP Header Value
   * @returns {string}
   */
  toString(): string {
    if (!this._string) {
      throw new Error('cannot stringify Token');
    }

    return this._string;
  }

  /**
   * Uses a non-production api to return information about this token. This
   * method is primarily for tests and will throw if NODE_ENV === production
   * @returns {Promise}
   */
  validate(): Promise<any> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Token#validate() must not be used in production');
    }

    return this.webex
      .request({
        method: 'POST',
        service: 'conversation',
        resource: 'users/validateAuthToken',
        body: {
          token: (this as any).get('access_token'),
        },
      })
      .catch((reason: any) => {
        if ('statusCode' in reason) {
          return Promise.reject(reason);
        }
        this.logger.info("REMINDER: If you're investigating a network error here, it's normal");

        // If we got an error that isn't a WebexHttpError, assume the problem is
        // that we don't have the wdm plugin loaded and service/resource isn't
        // a valid means of identifying a request.
        const convApi =
          process.env.CONVERSATION_SERVICE ||
          process.env.CONVERSATION_SERVICE_URL ||
          'https://conv-a.wbx2.com/conversation/api/v1';

        return this.webex.request({
          method: 'POST',
          uri: `${convApi}/users/validateAuthToken`,
          body: {
            token: (this as any).get('access_token'),
          },
          headers: {
            authorization: `Bearer ${(this as any).get('access_token')}`,
          },
        });
      })
      .then((res: any) => res.body);
  }
}

export default Token;
