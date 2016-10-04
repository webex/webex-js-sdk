/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

module.exports = {
  maxAppLevelRedirects: 10,
  maxAuthenticationReplays: 1,
  maxReconnectAttempts: 1,
  trackingIdPrefix: '',
  asyncRequestTimeout: 20000,
  AlternateLogger: undefined,
  credentials: {
    /**
     * @description Indicates whether this application should use the Implicit
     * Grant flow (public client) or Authorization Code Grant flow (confidential client)
     * one of 'public' or 'confidential'
     * @type {string}
     */
    clientType: 'public',
    oauth: {
      service: 'spark'
    },
    logoutUri: process.env.COMMON_IDENTITY_LOGOUT_URI || 'https://idbroker.webex.com/idb/saml2/jsp/doSSO.jsp',

    /**
     * @type {string}
     */
    loginPath: '/cisco-common-identity/login',
    logoutPath: '/cisco-common-identity/logout',
    refreshPath: '/cisco-common-identity/refresh'
  },
  conversation: {
    allowedInboundTags: {
      'spark-mention': ['data-object-type', 'data-object-id', 'data-object-url']
    },
    allowedOutboundTags: {
      'spark-mention': ['data-object-type', 'data-object-id', 'data-object-url']
    },
    processDisplayName: function noop() {},
    processContent: function noop() {},
    allowedInboundStyles: [],
    allowedOutboundStyles: [],
    thumbnailMaxHeight: 960,
    thumbnailMaxWidth: 640,
    keepEncryptedProperties: false
  },
  avatar: {
    bulkFetchDebounceDelay: 50,
    /**
     * @description Milliseconds a cached avatar url is considered valid
     * @type {number}
     */
    cacheExpiration: 60*60*1000,
    /**
     * @description default avatar size to retrieve if no size is specified
     * @type {number}
     */
    defaultAvatarSize: 80
  },
  device: {
    deviceRegistrationUrl: process.env.DEVICE_REGISTRATION_URL || 'https://wdm-a.wbx2.com/wdm/api/v1/devices',
    defaults: {
      // FIXME most of these defaults shouldn't be here
      deviceName: 'DESKTOP',
      deviceType: 'DESKTOP',
      localizedModel: 'DESKTOP',
      model: 'DESKTOP',
      name: 'DESKTOP',
      systemName: 'DESKTOP',
      systemVersion: 42,
      capabilities: {
        sdpSupported: true,
        groupCallSupported: true
      }
    },
    embargoFailureMessage: 'Service is not available in your region',
    preAuthServices: {
      atlasServiceUrl: process.env.ATLAS_SERVICE_URL || 'https://atlas-a.wbx2.com/admin/api/v1',
      oauthServiceUrl: process.env.COMMON_IDENTITY_OAUTH_SERVICE_URL || 'https://idbroker.webex.com/idb/oauth2/v1/',
      samlServiceUrl: process.env.COMMON_IDENTITY_SAML_SERVICE_URL || 'https://idbroker.webex.com/idb/token/',
      regionServiceUrl: process.env.COMMON_IDENTITY_REGION_SERVICE_URL || 'https://ds.ciscospark.com/v1/region/'
    }
  },
  encryption: {
    joseOptions: {
      compact: true,
      contentAlg: 'A256GCM',
      protect: '*'
    },
    unusedKeyCount: 10,
    decryptionFailureMessage: 'This message cannot be decrypted',
    // The bulk fetch parameters are mostly arbitrary, but seemed to have the
    // best performance when I played around with them. Note that, at time of
    // writing, the bulkFetchQueueCap must be somewhere below 100 to avoid 500s
    // from the encryption service.
    bulkFetchDebounceDelay: 50,
    bulkFetchDebounceMutltiplier: 3,
    bulkFetchQueueCap: 50,
    /**
     * @description Milliseconds to wait before considering an unanswered
     * request to the KMS as failed.
     * @type {number}
     */
    kmsInitialTimeout: 6000,
    /**
     * @description Milliseconds after which a kms request is considered
     * permanently failed
     * @type {number}
     */
    kmsMaxTimeout: 32000
  },
  logger: {
    /**
     * @description Forces a specific logging level. You almost never want to
     * use this. Instead, override the `Logger.prototype._setLevel()`
     * @type {string}
     */
    level: undefined,
    /**
     * @description Maximum entries stored in the buffer (array length)
     * @type {number}
     */
    maxBufferSize: 1000
  },
  mercury: {
    enablePingPong: true,
    pingInterval: 15000,
    pongTimeout: 14000,
    backoffTimeReset: 1000,
    backoffTimeMax: 32000,
    forceCloseDelay: 2000
  },
  metrics: {
    enableMetrics: true,
    bulkFetchDebounceDelay: 500
  },
  support: {
    appVersion: null,
    appType: null,
    languageCode: 'en'
  },
  user: {
    registrationDefaults: {
      pushId: 'not a push enabled device',
      deviceId: 'device id not yet defined',
      deviceName: 'DESKTOP'
    },
    /**
     * browser-only Specifies the path at which your server proxies ATLAS/users/email/activate
     * @type {string}
     */
    activatePath: '/users/email/activate',
    /**
     * browser-only Specifies the path at which your server proxies ATLAS/users/email/verify
     * @type {string}
     */
    registerPath: '/users/email/verify',
    /**
     * browser-only Specifies the path at which your server proxies ATLAS/users/email/reverify
     * @type {string}
     */
    reverifyPath: '/users/email/reverify'
  },
  board: {
    enablePingPong: true,
    pingInterval: 15000,
    pongTimeout: 14000,
    backoffTimeReset: 1000,
    backoffTimeMax: 32000,
    forceCloseDelay: 2000
  }
};
