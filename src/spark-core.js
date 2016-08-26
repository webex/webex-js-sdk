/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var AmpersandState = require('ampersand-state');
var assign = require('lodash.assign');
var Client = require('./client');
var Credentials = require('./client/credentials');
var Encryption = require('./client/services/encryption/encryption');
var defaultConfig = require('./defaults');
var Device = require('./client/device');
var Logger = require('./client/logger');
var Mercury = require('./client/mercury');
var merge = require('lodash.merge');
var oneFlight = require('./util/one-flight');
var version = require('./version');

var SparkCore = AmpersandState.extend({
  children: {
    credentials: Credentials,
    device: Device,
    encryption: Encryption,
    // Note: {Client#initialize} depends on credentials and device already
    // having been initialized.
    client: Client,
    mercury: Mercury,
    logger: Logger
  },

  derived: {
    listening: {
      deps: ['mercury.listening'],
      fn: function listening() {
        return this.mercury.listening;
      }
    },

    isAuthenticated: {
      deps: ['credentials.isAuthenticated'],
      fn: function isAuthenticated() {
        return this.credentials.isAuthenticated;
      }
    },

    isAuthenticating: {
      desp: ['credentials.isAuthenticating'],
      fn: function isAuthenticating() {
        return this.credentials.isAuthenticating;
      }
    },

    ready: {
      deps: [
        'credentials.isAuthenticated',
        'device.url'
      ],
      fn: function ready() {
        return !!(this.credentials.isAuthenticated && this.device.url);
      }
    },

    trackingID: {
      deps: ['trackingId'],
      fn: function trackingID() {
        return this.trackingId;
      }
    },

    trackingId: {
      deps: ['client.trackingId'],
      fn: function trackingId() {
        return this.client.trackingId;
      }
    },

    version: {
      cache: false,
      fn: function v() {
        return version.version;
      }
    }
  },

  session: {
    config: {
      type: 'object'
    }
  },

  authenticate: oneFlight('authenticate', function authenticate() {
    this.logger.info('spark: authenticating');

    return this.credentials.authenticate.apply(this.credentials, arguments)
      .then(this.device.refresh.bind(this.device));
  }),

  initialize: function initialize() {
    this.config = merge({}, defaultConfig, this.config);

    // Many of these checks belong in other files, but because of the way
    // AmpersandState#children works, this is the only `initialize` method that
    // has access to `config`. At some point in the future, we'll need a better
    // way of setting `config` and `defaults`.
    if (!this.config.trackingIdPrefix) {
      throw new Error('`config.trackingIdPrefix` is required');
    }

    if (!this.config.credentials.oauth) {
      throw new Error('`config.credentials.oauth` is required');
    }

    if (!this.config.credentials.oauth.client_id) {
      throw new Error('`config.credentials.oauth.client_id` is required');
    }

    if (!this.config.credentials.oauth.client_secret) {
      throw new Error('`config.credentials.oauth.client_secret` is required');
    }

    if (!this.config.credentials.oauth.redirect_uri) {
      throw new Error('`config.credentials.oauth.redirect_uri` is required');
    }

    // Make nested events propagate in a consistent manner
    this.listenTo(this.credentials, 'change', function triggerCredentialsChange() {
      var args = Array.prototype.slice(arguments);
      args.unshift('change:credentials');
      this.trigger.apply(this, args);
    });

    this.listenTo(this.device, 'change', function triggerDeviceChange() {
      var args = Array.prototype.slice(arguments);
      args.unshift('change:device');
      this.trigger.apply(this, args);
    });
  },

  logout: function logout() {
    this.logger.info('spark: logging out');

    return this.device.remove()
      .catch(function logDeviceRemovalFailure(reason) {
        this.logger.warn(reason);
      })
      .then(function clearEncryptStore() {
        this.encryption.keystore.clear();
      }.bind(this))
      .then(function cleanUpAndNotify() {
        this.trigger('client:logout');
        this.credentials.logout();
        return Promise.resolve();
      }.bind(this));
  },

  refresh: function refresh() {
    if (!this.isAuthenticated) {
      return Promise.reject(new Error('cannot call Spark#refresh without already being authenticated'));
    }

    this.logger.info('spark: authenticating');

    return this.authenticate.apply(this, arguments);
  },

  request: function request() {
    return this.client.request.apply(this.client, arguments);
  },

  serialize: function serialize(options) {
    var attrOpts = assign({props: true}, options);
    var res = this.getAttributes(attrOpts, true);
    assign(res, {
      credentials: this.credentials.serialize(options),
      device: this.device.serialize(options)
    });
    return res;
  },

  upload: function upload() {
    return this.client.upload.apply(this.client, arguments);
  }
});

var children = {};
var constructorCalled = false;
var Spark;

function registerService(name, constructor, options) {
  if (constructorCalled) {
    var message = 'registerService() should not be called after instantiating a Spark instance';
    /* eslint no-console: [0] */
    console.warn(message);
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      throw new Error(message);
    }
  }
  options = options || {};

  if (!children[name] || options.replace) {
    children[name] = constructor;
    makeSparkConstructor();
  }
}

function makeSparkConstructor() {
  Spark = SparkCore.extend({children: children});
}

function ProxySpark(config, options) {
  if (!Spark) {
    makeSparkConstructor();
  }

  constructorCalled = true;
  var spark = new Spark(config, options);
  return spark;
}

Object.defineProperty(ProxySpark, 'version', {
  writable: false,
  enumerable: false,
  value: version.version
});

Object.defineProperty(ProxySpark, 'registerService', {
  value: registerService
});

module.exports = ProxySpark;
