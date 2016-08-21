/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var defaults = require('lodash.defaults');
var difference = require('lodash.difference');
var FeaturesModel = require('./features-model');
var omit = require('lodash.omit');
var oneFlight = require('../../util/one-flight');
var pick = require('lodash.pick');
var isObject = require('lodash.isobject');
var isArray = require('lodash.isarray');
var SparkBase = require('../../lib/spark-base');
var MediaClusterCollection = require('./media-cluster-collection');

/**
 * @class
 * @extends {SparkBase}
 */
var Device = SparkBase.extend({
  children: {
    features: FeaturesModel
  },

  collections: {
    mediaClusters: MediaClusterCollection
  },

  props: {
    intranetInactivityDuration: 'number',
    intranetInactivityCheckUrl: 'string'
  },

  derived: {
    policy: {
      deps: ['intranetInactivityDuration', 'intranetInactivityCheckUrl'],
      fn: function _createPolicy() {
        return (this.intranetInactivityCheckUrl &&
                this.intranetInactivityDuration) ?
          {
            duration: this.intranetInactivityDuration,
            sites: [this.intranetInactivityCheckUrl]
          } : null;
      }
    }
  },

  session: {
    timer: 'any',
    durationMS: 'number'
  },

  extraProperties: 'allow',

  idAttribute: 'url',

  namespace: 'Device',

  constructor: function constructor(attrs, options) {
    options = options || {};
    defaults(options, {parse: true});
    return SparkBase.prototype.constructor.call(this, attrs, options);
  },

  parse: function parse(attrs) {
    if (!attrs) {
      return {};
    }

    if (attrs.mediaClusters) {
      var mediaClustersList = [];
      for (var key in attrs.mediaClusters) {
        if (key === 0) {
          return attrs;
        }
        var urls = [];
        var mediaCluster = attrs.mediaClusters[key];
        for (var i = 0; i < mediaCluster.length; ++i) {
          var url = mediaCluster[i];
          if (url) {
            urls.push({url: url});
          }
        }
        mediaClustersList.push({id: key, urls: urls});
      }
      attrs.mediaClusters = mediaClustersList;
    }

    return attrs;
  },

  _initPolicy: function _initPolicy() {
    if (this.policy) {
      this.durationMS = this.policy.duration*1000;

      if (isArray(this.policy.sites)) {
        return this.policy.sites.reduce(function _pingSites(sequence, site) {
          return sequence
            .catch(function _tryNextSite() {
              return this.request(site, {method: 'GET'});
            }.bind(this))
            .then(function _checkPingResults(res) {
              if (res && res.body) {
                if (res.body.ping === 'pong') {
                  return Promise.resolve(res);
                }
              }
              return Promise.reject();
            });
        }.bind(this), Promise.reject())
          .then(function _pingInternalSiteSuccessful() {
            this.logger.debug('We were able to hit an internal site. Do nothing');
          }.bind(this))
          .catch(function _setTimer() {
            this.spark.conversation.off('activity:sent', this._resetTimer, this);
            this.spark.conversation.on('activity:sent', this._resetTimer, this);
            this._resetTimer();
          }.bind(this));
      }
      else {
        this._clearTimer();
      }
    }
    else {
      this._clearTimer();
    }
  },

  _clearTimer: function _clearTimer() {
    this.durationMS = null;
    clearTimeout(this.timer);
    this.timer = null;
  },

  _resetTimer: function _resetTimer() {
    clearTimeout(this.timer);
    this.timer = setTimeout(this.spark.logout.bind(this.spark), this.durationMS);
  },

  initialize: function initialize() {
    this._initPolicy();
    this.on('change:policy', this._initPolicy.bind(this));

    function triggerChange() {
      this.trigger('change:features', this.features);
    }

    this.features.on('change:developer', triggerChange.bind(this));
    this.features.on('change:entitlement', triggerChange.bind(this));
    this.features.on('change:user', triggerChange.bind(this));
  },

  getServiceUrl: function getServiceUrl(service) {
    if (!service) {
      throw new Error('`service` is a required parameter');
    }

    /* istanbul ignore else */
    if (this.services) {
      return this.services[service + 'ServiceUrl'];
    }
  },

  getPreAuthServiceUrl: function getPreAuthServiceUrl(service) {
    if (!service) {
      throw new Error('`service` is a required parameter');
    }

    return this.config.preAuthServices[service + 'ServiceUrl'];
  },

  isDeviceRegistrationUrl: function isDeviceRegistrationUrl(url) {
    if (!url) {
      throw new Error('`url` is a required parameter');
    }

    return url === this.url || url === this.config.deviceRegistrationUrl;
  },

  isPreAuthService: function isPreAuthService(service) {
    if (!service) {
      throw new Error('`service` is a required parameter');
    }

    return !!this.getPreAuthServiceUrl(service);
  },

  isPreAuthServiceUrl: function isPreAuthServiceUrl(uri) {
    if (!uri) {
      throw new Error('`uri` is a required parameter');
    }

    for (var key in this.config.preAuthServices) {
      /* istanbul ignore else */
      if (Object.hasOwnProperty.call(this.config.preAuthServices, key)) {
        if (uri.indexOf(this.config.preAuthServices[key]) === 0) {
          return true;
        }
      }
    }

    return false;
  },

  isValidService: function isValidService(service) {
    if (!service) {
      throw new Error('`service` is a required parameter');
    }

    return !!this.getServiceUrl(service);
  },

  isServiceUrl: function isValidServiceUrl(uri) {
    if (!uri) {
      throw new Error('`uri` is a required parameter');
    }

    for (var key in this.services) {
      /* istanbul ignore else */
      if (Object.hasOwnProperty.call(this.services, key)) {
        if (uri.indexOf(this.services[key]) === 0) {
          return true;
        }
      }
    }

    return false;
  },

  /**
   * Refreshes an existing device registration
   * @memberof Device.prototype
   * @returns {Promise} Resolves when device information has been updated
   */
  refresh: oneFlight('refresh', function refresh() {
    this.logger.info('device: refresh requested');

    if (!this.url) {
      this.logger.info('device: device not registered, registering');

      return this.register();
    }

    return this._locate()
      .then(function refreshWithRegionData(region) {
        var options = {
          uri: this.url,
          method: 'PUT',
          body: defaults({}, pick(region, 'countryCode', 'regionCode', 'clientAddress'), omit(this.serialize(), 'features', 'mediaClusters'))
        };

        this.logger.info('device: refreshing');

        return this.request(options);
      }.bind(this))
      .then(this._processRegistrationSuccess.bind(this))
      .catch(function handle404(res) {
        // If we get a 404, it means the device is no longer valid and we need
        // to register a new one.
        if (res.statusCode === 404) {
          return this._clearProps()
            .then(this.register.bind(this));
        }

        throw res;
      }.bind(this))
      .catch(this._processRegistrationFailure.bind(this));
  }),

  /**
   * Registers a new Device
   * @memberof Device.prototype
   * @returns {Promise} Resolves when device information has been updated
   */
  register: oneFlight('register', function register() {
    this.logger.info('device: register requested');

    if (this.url) {
      this.logger.info('device: device already registered, refreshing');

      return this.refresh();
    }

    return this._locate()
      .then(function registerWithRegionData(region) {
        var options = {
          uri: this.config.deviceRegistrationUrl,
          method: 'POST',
          body: defaults({}, pick(region, 'countryCode', 'regionCode', 'clientAddress'), this.config.defaults)
        };

        this.logger.info('device: registering');

        return this.request(options);
      }.bind(this))
      .then(this._processRegistrationSuccess.bind(this))
      .catch(this._processRegistrationFailure.bind(this));
  }),

  /**
   * Unregisters the device
   * @memberof Device.prototype
   * @returns {Promise} Resolves when the device has been unregistered
   */
  remove: oneFlight('remove', function remove() {
    this.logger.info('device: unregister requested');

    if (!this.url) {
      throw new Error('device is not registered');
    }

    var options = {
      uri: this.url,
      method: 'DELETE'
    };

    this.logger.info('device: unregistering');

    return this.request(options)
      .then(this._clearProps.bind(this));
  }),

  _clearProps: function _clearProps(options) {
    this.logger.info('device: unregistered or registration failed');

    this.unset(Object.keys(this.getAttributes({props: true})), options);
    this.features.developer.reset([]);
    this.features.entitlement.reset([]);
    this.features.user.reset([]);
  },

  _processRegistrationFailure: function _processRegistrationFailure(res) {
    if (res.statusCode === 451) {
      this.logger.warn('device: registration failed for legal reasons');

      this._clearProps();
      return Promise.reject(new Error(this.config.embargoFailureMessage));
    }

    return Promise.reject(res);
  },

  _processRegistrationSuccess: function _processRegistrationSuccess(res) {
    this.logger.info('device: registered or refreshed');

    // Determine which current properties have been removed and unset them
    // (without firing a change event)
    var diff = difference(this, res.body);
    this.unset(diff, {silent: true});

    // And now set the newly received properties (and fire a change event)
    this.set(res.body);
  },

  _locate: function _locate() {
    this.logger.info('device: location requested');

    return this.request({
      api: 'region',
      resource: '/',
      method: 'GET'
    })
      .then(function processResponse(res) {
        this.logger.info('device: location received');

        return res.body;
      }.bind(this))
      .catch(function processErrorResponse(res) {
        // Ignore errors
        this.logger.warn('failed to retrieve region data', res.statusCode, res.body);
        return {};
      }.bind(this));
  },
  set: function set(key, value, options) {
    var attrs;
    // Handle both `"key", value` and `{key: value}` -style arguments.
    if (isObject(key) || key === null) {
      attrs = key;
      options = value;
    }
    else {
      attrs = {};
      attrs[key] = value;
    }

    attrs = this.parse(attrs, options);
    return SparkBase.prototype.set.call(this, attrs, options);
  }
});

module.exports = Device;
