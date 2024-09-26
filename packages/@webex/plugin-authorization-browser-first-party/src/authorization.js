/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint camelcase: [0] */

import querystring from 'querystring';
import url from 'url';

import {base64, oneFlight, whileInFlight} from '@webex/common';
import {grantErrors, WebexPlugin} from '@webex/webex-core';
import {cloneDeep, isEmpty, omit} from 'lodash';
import uuid from 'uuid';
import base64url from 'crypto-js/enc-base64url';
import CryptoJS from 'crypto-js';

// Necessary to require lodash this way in order to stub
// methods in the unit test
const lodash = require('lodash');

const OAUTH2_CSRF_TOKEN = 'oauth2-csrf-token';
const OAUTH2_CODE_VERIFIER = 'oauth2-code-verifier';

/**
 * Browser support for OAuth2. Automatically parses the URL query for an
 * authorization code
 *
 * Use of this plugin for anything other than the Webex Web Client is strongly
 * discouraged and may be broken at any time
 * @class
 * @name AuthorizationBrowserFirstParty
 * @private
 */
const Authorization = WebexPlugin.extend({
  derived: {
    /**
     * Alias of {@link AuthorizationBrowserFirstParty#isAuthorizing}
     * @instance
     * @memberof AuthorizationBrowserFirstParty
     * @type {boolean}
     */
    isAuthenticating: {
      deps: ['isAuthorizing'],
      fn() {
        return this.isAuthorizing;
      },
    },
  },

  session: {
    /**
     * Indicates if an Authorization Code exchange is inflight
     * @instance
     * @memberof AuthorizationBrowserFirstParty
     * @type {boolean}
     */
    isAuthorizing: {
      default: false,
      type: 'boolean',
    },
    ready: {
      default: false,
      type: 'boolean',
    },
  },

  namespace: 'Credentials',

  /**
   * Initializer
   * @instance
   * @memberof AuthorizationBrowserFirstParty
   * @private
   * @returns {Authorization}
   */
  // eslint-disable-next-line complexity
  initialize(...attrs) {
    const ret = Reflect.apply(WebexPlugin.prototype.initialize, this, attrs);
    const location = url.parse(this.webex.getWindow().location.href, true);

    this._checkForErrors(location);

    const {code} = location.query;

    if (!code) {
      this.ready = true;

      return ret;
    }

    if (location.query.state) {
      location.query.state = JSON.parse(base64.decode(location.query.state));
    } else {
      location.query.state = {};
    }

    const codeVerifier = this.webex.getWindow().sessionStorage.getItem(OAUTH2_CODE_VERIFIER);

    this.webex.getWindow().sessionStorage.removeItem(OAUTH2_CODE_VERIFIER);

    const {emailhash} = location.query.state;

    this._verifySecurityToken(location.query);
    this._cleanUrl(location);

    let preauthCatalogParams;

    const orgId = this._extractOrgIdFromCode(code);

    if (emailhash) {
      preauthCatalogParams = {emailhash};
    } else if (orgId) {
      preauthCatalogParams = {orgId};
    }

    // Wait until nextTick in case `credentials` hasn't initialized yet
    process.nextTick(() => {
      this.webex.internal.services
        .collectPreauthCatalog(preauthCatalogParams)
        .catch(() => Promise.resolve())
        .then(() => this.requestAuthorizationCodeGrant({code, codeVerifier}))
        .catch((error) => {
          this.logger.warn('authorization: failed initial authorization code grant request', error);
        })
        .then(() => {
          this.ready = true;
        });
    });

    return ret;
  },

  /**
   * Kicks off an oauth flow
   * @instance
   * @memberof AuthorizationBrowserFirstParty
   * @param {Object} options
   * @returns {Promise}
   */
  initiateLogin(options = {}) {
    options = cloneDeep(options);
    if (options.email) {
      options.emailHash = CryptoJS.SHA256(options.email).toString();
    }
    delete options.email;
    options.state = options.state || {};
    options.state.csrf_token = this._generateSecurityToken();
    // catalog uses emailhash and redirectCI uses emailHash
    options.state.emailhash = options.emailHash;

    options.code_challenge = this._generateCodeChallenge();
    options.code_challenge_method = 'S256';

    return this.initiateAuthorizationCodeGrant(options);
  },

  @whileInFlight('isAuthorizing')
  /**
   * Kicks off the Implicit Code grant flow. Typically called via
   * {@link AuthorizationBrowserFirstParty#initiateLogin}
   * @instance
   * @memberof AuthorizationBrowserFirstParty
   * @param {Object} options
   * @returns {Promise}
   */
  initiateAuthorizationCodeGrant(options) {
    this.logger.info('authorization: initiating authorization code grant flow');
    this.webex.getWindow().location = this.webex.credentials.buildLoginUrl(
      Object.assign({response_type: 'code'}, options)
    );

    return Promise.resolve();
  },

  /**
   * Called by {@link WebexCore#logout()}. Redirects to the logout page
   * @instance
   * @memberof AuthorizationBrowserFirstParty
   * @param {Object} options
   * @param {boolean} options.noRedirect if true, does not redirect
   * @returns {Promise}
   */
  logout(options = {}) {
    if (!options.noRedirect) {
      this.webex.getWindow().location = this.webex.credentials.buildLogoutUrl(options);
    }
  },

  @whileInFlight('isAuthorizing')
  @oneFlight
  /**
   * Exchanges an authorization code for an access token
   * @instance
   * @memberof AuthorizationBrowserFirstParty
   * @param {Object} options
   * @param {Object} options.code
   * @returns {Promise}
   */
  requestAuthorizationCodeGrant(options = {}) {
    this.logger.info('credentials: requesting authorization code grant');

    if (!options.code) {
      return Promise.reject(new Error('`options.code` is required'));
    }

    const form = {
      grant_type: 'authorization_code',
      redirect_uri: this.config.redirect_uri,
      code: options.code,
      self_contained_token: true,
    };

    if (options.codeVerifier) {
      form.code_verifier = options.codeVerifier;
    }

    return this.webex
      .request({
        method: 'POST',
        uri: this.config.tokenUrl,
        form,
        auth: {
          user: this.config.client_id,
          pass: this.config.client_secret,
          sendImmediately: true,
        },
        shouldRefreshAccessToken: false,
      })
      .then((res) => {
        this.webex.credentials.set({supertoken: res.body});
      })
      .catch((res) => {
        if (res.statusCode !== 400) {
          return Promise.reject(res);
        }

        const ErrorConstructor = grantErrors.select(res.body.error);

        return Promise.reject(new ErrorConstructor(res._res || res));
      });
  },

  /**
   * Extracts the orgId from the returned code from idbroker
   * Description of how to parse the code can be found here:
   * https://wiki.cisco.com/display/IDENTITY/Federated+Token+Validation
   * @instance
   * @memberof AuthorizationBrowserFirstParty
   * @param {String} code
   * @private
   * @returns {String}
   */
  _extractOrgIdFromCode(code) {
    return code?.split('_')[2] || undefined;
  },

  /**
   * Checks if the result of the login redirect contains an error string
   * @instance
   * @memberof AuthorizationBrowserFirstParty
   * @param {Object} location
   * @private
   * @returns {Promise}
   */
  _checkForErrors(location) {
    const {query} = location;

    if (query && query.error) {
      const ErrorConstructor = grantErrors.select(query.error);

      throw new ErrorConstructor(query);
    }
  },

  /**
   * Removes no-longer needed values from the url (access token, csrf token, etc)
   * @instance
   * @memberof AuthorizationBrowserFirstParty
   * @param {Object} location
   * @private
   * @returns {Promise}
   */
  _cleanUrl(location) {
    location = cloneDeep(location);
    if (this.webex.getWindow().history && this.webex.getWindow().history.replaceState) {
      Reflect.deleteProperty(location.query, 'code');
      if (isEmpty(omit(location.query.state, 'csrf_token'))) {
        Reflect.deleteProperty(location.query, 'state');
      } else {
        location.query.state = base64.encode(
          JSON.stringify(omit(location.query.state, 'csrf_token'))
        );
      }
      location.search = querystring.stringify(location.query);
      Reflect.deleteProperty(location, 'query');
      this.webex.getWindow().history.replaceState({}, null, url.format(location));
    }
  },

  /**
   * Generates PKCE code verifier and code challenge and sets the the code verifier in sessionStorage
   * @instance
   * @memberof AuthorizationBrowserFirstParty
   * @private
   * @returns {string}
   */
  _generateCodeChallenge() {
    this.logger.info('authorization: generating PKCE code challenge');

    // eslint-disable-next-line no-underscore-dangle
    const safeCharacterMap = base64url._safe_map;

    const codeVerifier = lodash
      .times(128, () => safeCharacterMap[lodash.random(0, safeCharacterMap.length - 1)])
      .join('');

    const codeChallenge = CryptoJS.SHA256(codeVerifier).toString(base64url);

    this.webex.getWindow().sessionStorage.setItem(OAUTH2_CODE_VERIFIER, codeVerifier);

    return codeChallenge;
  },

  /**
   * Generates a CSRF token and sticks in in sessionStorage
   * @instance
   * @memberof AuthorizationBrowserFirstParty
   * @private
   * @returns {Promise}
   */
  _generateSecurityToken() {
    this.logger.info('authorization: generating csrf token');

    const token = uuid.v4();

    this.webex.getWindow().sessionStorage.setItem('oauth2-csrf-token', token);

    return token;
  },

  /**
   * Checks if the CSRF token in sessionStorage is the same as the one returned
   * in the url.
   * @instance
   * @memberof AuthorizationBrowserFirstParty
   * @param {Object} query
   * @private
   * @returns {Promise}
   */
  _verifySecurityToken(query) {
    const sessionToken = this.webex.getWindow().sessionStorage.getItem(OAUTH2_CSRF_TOKEN);

    this.webex.getWindow().sessionStorage.removeItem(OAUTH2_CSRF_TOKEN);
    if (!sessionToken) {
      return;
    }

    if (!query.state) {
      throw new Error(`Expected CSRF token ${sessionToken}, but not found in redirect query`);
    }

    if (!query.state.csrf_token) {
      throw new Error(`Expected CSRF token ${sessionToken}, but not found in redirect query`);
    }

    const token = query.state.csrf_token;

    if (token !== sessionToken) {
      throw new Error(`CSRF token ${token} does not match stored token ${sessionToken}`);
    }
  },
});

export default Authorization;
