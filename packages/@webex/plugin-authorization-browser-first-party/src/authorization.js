 // @ts-nocheck
/* eslint-disable */
/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint camelcase: [0] */
/**
 * TS checking disabled: file uses legacy decorator syntax inside an object literal
 * transformed by Babel. Safe to ignore for now.
 */

import querystring from 'querystring';
import url from 'url';
import {EventEmitter} from 'events';

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
 * Authorization plugin events
 */
export const Events = {
  login: 'login',
  /**
   * QR code login events
   */
  qRCodeLogin: 'qRCodeLogin',
};

/**
 * Browser support for OAuth2 for first-party (Webex Web Client) usage.
 *
 * High-level flow handled by this module:
 * 1. initiateLogin() constructs authorization request (adds CSRF + PKCE).
 * 2. Browser navigates to IdBroker (login).
 * 3. IdBroker redirects back with ?code=... (&state=...).
 * 4. initialize() detects code, validates state/CSRF, cleans URL, optionally
 *    pre-fetches a preauth catalog, then exchanges the code via
 *    requestAuthorizationCodeGrant().
 * 5. Sets resulting supertoken (access/refresh token bundle) on credentials.
 *
 * Additional supported flow:
 * - Device Authorization (QR Code login):
 *   initQRCodeLogin() obtains device + user codes and begins polling
 *   _startQRCodePolling() until tokens are issued or timeout/cancel occurs.
 *
 * Security considerations implemented:
 * - CSRF token (state.csrf_token) generation + verification.
 * - PKCE (S256) code verifier + challenge generation and consumption.
 * - URL cleanup after redirect (removes code & CSRF to prevent leakage).
 *
 * Use of this plugin for anything other than the Webex Web Client is discouraged.
 *
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
    /**
     * Indicates that the plugin has finished any automatic startup
     * processing (e.g., exchanging a returned authorization code)
     */
    ready: {
      default: false,
      type: 'boolean',
    },
  },

  namespace: 'Credentials',

  /**
   * EventEmitter for authorization events such as QR code login progress
   * @instance
   * @memberof AuthorizationBrowserFirstParty
   * @type {EventEmitter}
   * @public
   */
  eventEmitter: new EventEmitter(),

  /**
   * Stores the timer ID for QR code polling (device authorization)
   * @instance
   * @memberof AuthorizationBrowserFirstParty
   * @type {?number}
   * @private
   */
  pollingTimer: null,
  /**
   * Stores the expiration timer ID for QR code polling (overall timeout)
   * @instance
   * @memberof AuthorizationBrowserFirstParty
   * @type {?number}
   * @private
   */
  pollingExpirationTimer: null,

  /**
   * Monotonically increasing id to identify the current polling request.
   * Used to safely ignore late poll responses after a cancel/reset.
   * @instance
   * @memberof AuthorizationBrowserFirstParty
   * @type {number}
   * @private
   */
  pollingId: 0,

  /**
   * Identifier for the current polling request (snapshot of pollingId)
   * @instance
   * @memberof AuthorizationBrowserFirstParty
   * @type {?number}
   * @private
   */
  currentPollingId: null,

  /**
   * Auto executes during Webex.init() – you do NOT call this yourself.
   *
   * Purpose: Seamless "redirect completion" of the OAuth Authorization Code (+ PKCE) flow.
   *
   * Simple summary:
   * - You call initiateLogin() which redirects user to IdBroker.
   * - User signs in; IdBroker redirects back to your redirect_uri with ?code=... (&state=...).
   * - During SDK startup this initialize() runs automatically, sees the code, and
   *   silently finishes the login (validates state/CSRF + PKCE, scrubs URL, exchanges code).
   * - When done, webex.credentials.supertoken holds access+refresh and ready=true.
   *
   * Step-by-step:
   * 1. Inspect current window.location for ?code= (& state=).
   * 2. If no code: set ready=true immediately (nothing to complete).
   * 3. If code present:
   *    - Decode base64 state JSON.
   *    - Verify CSRF token matches sessionStorage value.
   *    - Retrieve then delete PKCE code_verifier (single use).
   *    - Optionally derive preauth hint (emailhash in state OR orgId parsed from code).
   *    - Clean the URL (history.replaceState) to remove code & csrf token data.
   *    - nextTick:
   *        a. Best‑effort preauth catalog fetch (non-blocking).
   *        b. Exchange authorization code (with code_verifier if any) for supertoken
   *           and store on webex.credentials.
   * 4. Set ready=true after the async sequence finishes (or immediately if step 2).
   *
   * Result: If the redirect included a valid code the token exchange is completed
   * automatically—no extra API call needed after Webex.init().
   */
  // eslint-disable-next-line complexity
  initialize(...attrs) {
    const ret = Reflect.apply(WebexPlugin.prototype.initialize, this, attrs);
    const location = url.parse(this.webex.getWindow().location.href, true);

    // Check if redirect includes error
    this._checkForErrors(location);

    const {code} = location.query;

    // If no authorization code returned, nothing to do
    if (!code) {
      this.ready = true;
      return ret;
    }

    // Decode and parse state object (if present)
    if (location.query.state) {
      location.query.state = JSON.parse(base64.decode(location.query.state));
    } else {
      location.query.state = {};
    }

    // Retrieve PKCE code verifier (if a PKCE flow was initiated)
    const codeVerifier = this.webex.getWindow().sessionStorage.getItem(OAUTH2_CODE_VERIFIER);
    // Immediately remove code verifier to minimize exposure
    this.webex.getWindow().sessionStorage.removeItem(OAUTH2_CODE_VERIFIER);

    const {emailhash} = location.query.state;

    // Validate CSRF token included in state
    this._verifySecurityToken(location.query);
    // Remove code + CSRF token remnants from URL (history replace)
    this._cleanUrl(location);

    let preauthCatalogParams;

    // Attempt to extract orgId from structured authorization code (if present)
    const orgId = this._extractOrgIdFromCode(code);

    if (emailhash) {
      preauthCatalogParams = {emailhash};
    } else if (orgId) {
      preauthCatalogParams = {orgId};
    }

    // Defer token exchange until next tick in case credentials plugin not ready yet
    process.nextTick(() => {
      this.webex.internal.services
        .collectPreauthCatalog(preauthCatalogParams)
        .catch(() => Promise.resolve()) // Non-fatal if catalog collection fails
        .then(() => this.requestAuthorizationCodeGrant({code, codeVerifier}))
        .catch((error) => {
          this.logger.warn('authorization: failed initial authorization code grant request', error);
        })
        .then(() => {
          // Mark plugin ready regardless of success/failure of token exchange
          this.ready = true;
        });
    });

    return ret;
  },

  /**
   * Kicks off an OAuth authorization code flow (first party).
   *
   * Adds security + PKCE properties:
   * - SHA256(email) (emailHash & emailhash) for preauth and redirect flows
   * - state.csrf_token for CSRF protection
   * - PKCE code_challenge (S256)
   *
   * NOTE: This does not itself perform the redirect; it calls
   * initiateAuthorizationCodeGrant() which changes window location or opens
   * a separate window as configured.
   *
   * @instance
   * @memberof AuthorizationBrowserFirstParty
   * @param {Object} options
   * @returns {Promise}
   */
  initiateLogin(options = {}) {
    this.eventEmitter.emit(Events.login, {
      eventType: 'initiateLogin',
      data: {
        hasEmail: !!options.email,
        hasState: !!options.state
      },
    });

    options = cloneDeep(options);

    // Optionally compute heuristic email hash for preauth usage
    if (options.email) {
      options.emailHash = CryptoJS.SHA256(options.email).toString();
    }
    delete options.email; // Ensure raw email not propagated further

    options.state = options.state || {};
    // Embed CSRF token
    options.state.csrf_token = this._generateSecurityToken();
    // Provide email hash in lower-case key used by catalog service
    // (Note: catalog uses emailhash and redirectCI uses emailHash)
    options.state.emailhash = options.emailHash;

    // PKCE - produce code_challenge (S256) and persist code_verifier
    options.code_challenge = this._generateCodeChallenge();
    options.code_challenge_method = 'S256';

    return this.initiateAuthorizationCodeGrant(options);
  },

  @whileInFlight('isAuthorizing')
  /**
   * Performs the navigation step of the Authorization Code flow.
   * Builds login URL and either:
   *  - Replaces current window location (default), or
   *  - Opens a separate window (popup) if options.separateWindow supplied.
   *
   * Decorated with whileInFlight('isAuthorizing') to set isAuthorizing=true
   * during execution to prevent concurrent overlapping attempts.
   *
   * @instance
   * @memberof AuthorizationBrowserFirstParty
   * @param {Object} options - Already augmented with state + PKCE info
   * @returns {Promise<void>}
   */
  initiateAuthorizationCodeGrant(options) {
    this.logger.info('authorization: initiating authorization code grant flow');
    const loginUrl = this.webex.credentials.buildLoginUrl(
      Object.assign({response_type: 'code'}, options)
    );

    this.eventEmitter.emit(Events.login, {
      eventType: 'redirectToLoginUrl',
      data: { loginUrl },
    });

    if (options?.separateWindow) {
      // If a separate popup window is requested, combine user supplied window features
      const defaultWindowSettings = {
        width: 600,
        height: 800,
      };

      const windowSettings = Object.assign(
        defaultWindowSettings,
        typeof options.separateWindow === 'object' ? options.separateWindow : {}
      );

      const windowFeatures = Object.entries(windowSettings)
        .map(([key, value]) => `${key}=${value}`)
        .join(',');
      this.webex.getWindow().open(loginUrl, '_blank', windowFeatures);
    } else {
      // Normal (in-tab) redirect
      this.webex.getWindow().location = loginUrl;
    }

    return Promise.resolve();
  },

  /**
   * Called by {@link WebexCore#logout()}.
   * Constructs logout URL and (unless suppressed) navigates away to ensure
   * server-side session termination.
   *
   * @instance
   * @memberof AuthorizationBrowserFirstParty
   * @param {Object} options
   * @param {boolean} options.noRedirect if true, does not redirect
   * @returns {Promise<void>}
   */
  logout(options = {}) {
    if (!options.noRedirect) {
      this.webex.getWindow().location = this.webex.credentials.buildLogoutUrl(options);
    }
  },

  @whileInFlight('isAuthorizing')
  @oneFlight
  /**
   * Exchanges an authorization code for an access (super) token bundle.
   *
   * Decorators:
   * - @whileInFlight('isAuthorizing'): prevents overlapping exchanges.
   * - @oneFlight: collapses simultaneous calls into one network request.
   *
   * Includes PKCE code_verifier if present from earlier login initiation.
   *
   * Error Handling:
   * - Non-400 responses are propagated.
   * - 400 responses map to OAuth-specific grantErrors.
   *
   * @instance
   * @memberof AuthorizationBrowserFirstParty
   * @param {Object} options
   * @param {string} options.code - Authorization code from redirect
   * @param {string} [options.codeVerifier] - PKCE code verifier if used
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
      self_contained_token: true, // Request combined access/refresh response
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
        shouldRefreshAccessToken: false, // This is the token acquisition call itself
      })
      .then((res) => {
        // Store supertoken into credentials (includes refresh token)
        this.webex.credentials.set({supertoken: res.body});
      })
      .catch((res) => {
        if (res.statusCode !== 400) {
          return Promise.reject(res);
        }

        // Map standard OAuth error to strongly typed error class
        const ErrorConstructor = grantErrors.select(res.body.error);

        return Promise.reject(new ErrorConstructor(res._res || res));
      });
  },

  /**
   * Generate a QR code verification URL for device authorization flow.
   * When a user scans the QR code with a mobile device, this deep-links into
   * Webex (web) to continue login, including passing along userCode and the
   * helper service base URL.
   *
   * @instance
   * @memberof AuthorizationBrowserFirstParty
   * @param {String} verificationUrl - Original verification URI (complete)
   * @returns {String} Possibly rewritten verification URL
   */
  _generateQRCodeVerificationUrl(verificationUrl) {
    const baseUrl = 'https://web.webex.com/deviceAuth';
    const urlParams = new URLSearchParams(new URL(verificationUrl).search);
    const userCode = urlParams.get('userCode');

    if (userCode) {
      const {services} = this.webex.internal;
      const oauthHelperUrl = services.get('oauth-helper');
      const newVerificationUrl = new URL(baseUrl);
      newVerificationUrl.searchParams.set('usercode', userCode);
      newVerificationUrl.searchParams.set('oauthhelper', oauthHelperUrl);
      return newVerificationUrl.toString();
    } else {
      return verificationUrl;
    }
  },

  /**
   * Initiates Device Authorization (QR Code) flow.
   *
   * Steps:
   * 1. Obtain device_code, user_code, verification URLs from oauth-helper.
   * 2. Emit getUserCodeSuccess (provides data for generating QR code).
   * 3. Start polling token endpoint with device_code.
   *
   * Emits qRCodeLogin events for UI to react (success, failure, pending, etc.).
   *
   * @instance
   * @memberof AuthorizationBrowserFirstParty
   * @emits #qRCodeLogin
   */
  initQRCodeLogin() {
    if (this.pollingTimer) {
      // Prevent concurrent device authorization attempts
      this.eventEmitter.emit(Events.qRCodeLogin, {
        eventType: 'getUserCodeFailure',
        data: {message: 'There is already a polling request'},
      });
      return;
    }

    this.webex
      .request({
        method: 'POST',
        service: 'oauth-helper',
        resource: '/actions/device/authorize',
        form: {
          client_id: this.config.client_id,
          scope: this.config.scope,
        },
        auth: {
          user: this.config.client_id,
          pass: this.config.client_secret,
          sendImmediately: true,
        },
      })
      .then((res) => {
        const {user_code, verification_uri, verification_uri_complete} = res.body;
        const verificationUriComplete = this._generateQRCodeVerificationUrl(verification_uri_complete);
        this.eventEmitter.emit(Events.qRCodeLogin, {
          eventType: 'getUserCodeSuccess',
            userData: {
            userCode: user_code,
            verificationUri: verification_uri,
            verificationUriComplete,
          },
        });
        // Begin polling for authorization completion
        this._startQRCodePolling(res.body);
      })
      .catch((res) => {
        this.eventEmitter.emit(Events.qRCodeLogin, {
          eventType: 'getUserCodeFailure',
          data: res.body,
        });
      });
  },

  /**
   * Poll the device token endpoint until user authorizes, an error occurs,
   * or timeout happens.
   *
   * Polling behavior:
   * - Interval provided by server (default 2s). 'slow_down' doubles interval once.
   * - 428 status => pending (continue).
   * - Success => set credentials + emit authorizationSuccess + stop polling.
   * - Any other error => emit authorizationFailure + stop polling.
   *
   * Cancellation:
   * - cancelQRCodePolling() resets timers and polling ids so late responses are ignored.
   *
   * @instance
   * @memberof AuthorizationBrowserFirstParty
   * @param {Object} options - Must include device_code, may include interval/expires_in
   * @emits #qRCodeLogin
   */
  _startQRCodePolling(options = {}) {
    if (!options.device_code) {
      this.eventEmitter.emit(Events.qRCodeLogin, {
        eventType: 'authorizationFailure',
        data: {message: 'A deviceCode is required'},
      });
      return;
    }

    if (this.pollingTimer) {
      // Already polling; avoid starting a duplicate cycle
      this.eventEmitter.emit(Events.qRCodeLogin, {
        eventType: 'authorizationFailure',
        data: {message: 'There is already a polling request'},
      });
      return;
    }

    const {device_code: deviceCode, expires_in: expiresIn = 300} = options;
    // Server recommended polling interval (seconds)
    let interval = options.interval ?? 2;

    // Global timeout for entire device authorization attempt
    this.pollingExpirationTimer = setTimeout(() => {
      this.cancelQRCodePolling(false);
      this.eventEmitter.emit(Events.qRCodeLogin, {
        eventType: 'authorizationFailure',
        data: {message: 'Authorization timed out'},
      });
    }, expiresIn * 1000);

    const polling = () => {
      // Increment id so any previous poll loops can be invalidated
      this.pollingId += 1;
      this.currentPollingId = this.pollingId;

      this.webex
        .request({
          method: 'POST',
          service: 'oauth-helper',
          resource: '/actions/device/token',
          form: {
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
            device_code: deviceCode,
            client_id: this.config.client_id,
          },
          auth: {
            user: this.config.client_id,
            pass: this.config.client_secret,
            sendImmediately: true,
          },
        })
        .then((res) => {
          // If polling canceled (id changed), ignore this response
          if (this.currentPollingId !== this.pollingId) return;

            this.eventEmitter.emit(Events.qRCodeLogin, {
            eventType: 'authorizationSuccess',
            data: res.body,
          });
          this.webex.credentials.set({supertoken: res.body});
          this.cancelQRCodePolling();
        })
        .catch((res) => {
          if (this.currentPollingId !== this.pollingId) return;

          // Backoff signal from server; increase interval just once for next cycle
          if (res.statusCode === 400 && res.body.message === 'slow_down') {
            schedulePolling(interval * 2);
            return;
          }

          // Pending: keep polling
          if (res.statusCode === 428) {
            this.eventEmitter.emit(Events.qRCodeLogin, {
              eventType: 'authorizationPending',
              data: res.body,
            });
            schedulePolling(interval);
            return;
          }

          // Terminal error
          this.cancelQRCodePolling();

          this.eventEmitter.emit(Events.qRCodeLogin, {
            eventType: 'authorizationFailure',
            data: res.body,
          });
        });
    };

    // Schedules next poll invocation
    const schedulePolling = (interval) =>
      (this.pollingTimer = setTimeout(polling, interval * 1000));

    schedulePolling(interval);
  },

  /**
   * Cancel active device authorization polling loop.
   *
   * @param {boolean} withCancelEvent emit a pollingCanceled event (default true)
   * @instance
   * @memberof AuthorizationBrowserFirstParty
   * @returns {void}
   */
  cancelQRCodePolling(withCancelEvent = true) {
    if (this.pollingTimer && withCancelEvent) {
      this.eventEmitter.emit(Events.qRCodeLogin, {
        eventType: 'pollingCanceled',
      });
    }

    this.currentPollingId = null;

    clearTimeout(this.pollingExpirationTimer);
    this.pollingExpirationTimer = null;
    clearTimeout(this.pollingTimer);
    this.pollingTimer = null;
  },

  /**
   * Extracts the orgId from the returned code from idbroker.
   *
   * Certain authorization codes encode organization info in a structured
   * underscore-delimited format. This method parses out the 3rd segment.
   *
   * For undocumented formats or unexpected code shapes, returns undefined.
   *
   * @instance
   * @memberof AuthorizationBrowserFirstParty
   * @param {String} code
   * @private
   * @returns {String|undefined}
   */
  _extractOrgIdFromCode(code) {
    return code?.split('_')[2] || undefined;
  },

  /**
   * Checks if the result of the login redirect contains an OAuth error.
   * Throws a mapped grant error if encountered.
   *
   * @instance
   * @memberof AuthorizationBrowserFirstParty
   * @param {Object} location
   * @private
   * @returns {void}
   */
  _checkForErrors(location) {
    const {query} = location;

    if (query && query.error) {
      const ErrorConstructor = grantErrors.select(query.error);

      throw new ErrorConstructor(query);
    }
  },

  /**
   * Removes no-longer needed values from the URL (authorization code, CSRF token).
   * This is important to avoid leaking sensitive parameters via:
   * - Browser history
   * - Copy/paste of URL
   * - HTTP referrer headers to third-party content
   *
   * Approach:
   * - Remove 'code'.
   * - Remove 'state' entirely if only contained csrf_token.
   * - Else, re-encode remaining state fields (minus csrf_token).
   * - Replace current history entry (no page reload).
   *
   * @instance
   * @memberof AuthorizationBrowserFirstParty
   * @param {Object} location
   * @private
   * @returns {void}
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
   * Generates a PKCE (RFC 7636) code verifier and corresponding S256 code challenge.
   * Persists the verifier in sessionStorage (single-use) for later retrieval
   * during authorization code exchange; removes it once consumed.
   *
   * Implementation details:
   * - Creates a 128 character string using base64url safe alphabet.
   * - Computes SHA256 hash, encodes to base64url (no padding).
   *
   * @instance
   * @memberof AuthorizationBrowserFirstParty
   * @private
   * @returns {string} code_challenge
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
   * Generates a CSRF token and stores it in sessionStorage.
   * Token is embedded in 'state' and validated upon redirect return.
   *
   * Uses UUID v4 for randomness.
   *
   * @instance
   * @memberof AuthorizationBrowserFirstParty
   * @private
   * @returns {string} token
   */
  _generateSecurityToken() {
    this.logger.info('authorization: generating csrf token');

    const token = uuid.v4();

    this.webex.getWindow().sessionStorage.setItem('oauth2-csrf-token', token);

    return token;
  },

  /**
   * Verifies that the CSRF token returned in the 'state' matches the one
   * previously stored in sessionStorage.
   *
   * Steps:
   * - Retrieve and immediately remove stored token (one-time use).
   * - Ensure state + state.csrf_token exist.
   * - Compare values; throw descriptive errors on mismatch / absence.
   *
   * If no stored token (e.g., user navigated directly), silently returns.
   *
   * @instance
   * @memberof AuthorizationBrowserFirstParty
   * @param {Object} query - Parsed query (location.query)
   * @private
   * @returns {void}
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
