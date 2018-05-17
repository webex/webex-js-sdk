/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {oneFlight} from '@ciscospark/common';
import {safeSetTimeout} from '@ciscospark/common-timers';
import {omit} from 'lodash';
import util from 'util';
import FeaturesModel from './features-model';
import ServiceCollection from './service-collection';
import {persist, waitForValue, SparkPlugin} from '@ciscospark/spark-core';
import Url from 'url';

/**
 * Decides if this device should be persisted to boundedStorage, based on
 * this.config.ephemeral.
 * @returns {Boolean}
 */
function decider() {
  return !this.config.ephemeral;
}

const Device = SparkPlugin.extend({
  children: {
    features: FeaturesModel
  },

  collections: {
    serviceCatalog: ServiceCollection
  },

  idAttribute: 'url',

  namespace: 'Device',

  props: {
    // deviceType doesn't have any real value, but we need to send it during
    // device refresh to make sure we don't get back an ios device url
    deviceType: 'string',
    intranetInactivityDuration: 'number',
    intranetInactivityCheckUrl: 'string',
    modificationTime: 'string',
    searchEncryptionKeyUrl: 'string',
    services: {
      // Even though @jodykstr will tell you the docs claim you don't need to
      // initialize `object` properties, the docs lie.
      default() {
        return {};
      },
      type: 'object'
    },
    serviceHostMap: {
      default() {
        return {
          serviceLinks: {},
          hostCatalog: {}
        };
      },
      type: 'object'
    },
    url: 'string',
    userId: 'string',
    /**
     * Notifies the client if file sharing is disabled.
     * Currently, the values for it are:
     * - BLOCK_BOTH
     * - BLOCK_UPLOAD
     * @instance
     * @memberof Device
     * @type {string}
     */
    webFileShareControl: 'string',
    webSocketUrl: 'string'
  },

  derived: {
    registered: {
      deps: ['url'],
      fn() {
        return Boolean(this.url);
      }
    }
  },

  session: {
    // Fun Fact: setTimeout returns a Timer object instead of a Number in Node 6
    // or later
    logoutTimer: 'any',
    lastUserActivityDate: 'number'
  },

  @waitForValue('@')
  determineService(url) {
    for (const key of Object.keys(this.services)) {
      const serviceUrl = this.services[key];
      if (url.startsWith(serviceUrl)) {
        // "ServiceUrl" is 10 characters
        return Promise.resolve(key.substr(0, key.length - 10));
      }
    }

    return Promise.reject(new Error(`${url} does not reflect a known service`));
  },

  @waitForValue('@')
  getServiceUrl(service) {
    return this._getServiceUrl(this.services, service)
      .then((isServiceUrl) => isServiceUrl || this.getPreDiscoveryServiceUrl(service));
  },

  getPreDiscoveryServiceUrl(service) {
    // The Promise.resolve here is temporary. A future PR will make the
    // corresponding _ method async to allow for lazy device registration
    return Promise.resolve(this._getServiceUrl(this.config.preDiscoveryServices, service));
  },

  getWebSocketUrl() {
    return this.useServiceCatalogUrl(this.webSocketUrl);
  },

  useServiceCatalogUrl(uri) {
    return this.serviceCatalog.inferServiceFromUrl(uri)
      .then((s) => s.replaceUrlWithCurrentHost(uri));
  },

  markUrlFailedAndGetNew(url) {
    if (!url) {
      return Promise.reject(new Error('`url` is a required parameter'));
    }

    this.logger.info(`device: marking ${url} as failed`);
    return this.serviceCatalog.markFailedAndCycleUrl(url)
      .then((uri) => {
        this.spark.internal.metrics.submitClientMetrics('web-ha', {
          tags: {
            action: 'replace_url',
            failedUrl: url,
            newUrl: uri
          }
        });
        return uri;
      })
      // it's likely we fail here because we've cycled though all hosts,
      // reset all hosts and then retry connecting
      .catch(() => this._resetAllAndRetry(url));
  },

  _resetAllAndRetry(url) {
    if (!url) {
      return Promise.reject(new Error('`url` is a required parameter'));
    }

    this.logger.info(`device: reset available hosts and retry ${url}`);
    return this.serviceCatalog.resetAllAndRetry(url);
  },

  // this function is exposed beyond the device file
  fetchNewUrls(url) {
    // we want to get the current service first, just in case the
    // refreshed catalog has different host names
    return new Promise((resolve) => this.serviceCatalog.inferServiceFromUrl(url)
      .then((s) => {
        this.logger.info(`device: refresh to ${s.service} get new urls`);
        this.refresh();
        this.on('serviceCatalogUpdated', () => resolve(s.url));
      }));
  },

  @persist('@', decider)
  initialize(...args) {
    Reflect.apply(SparkPlugin.prototype.initialize, this, args);

    // Propagate change(:[attribute]) events from collections
    ['developer', 'entitlement', 'user'].forEach((collectionName) => {
      this.features.on(`change:${collectionName}`, (model, value, options) => {
        this.trigger('change', this, options);
        this.trigger('change:features', this, this.features, options);
      });
    });

    this.on('change:serviceHostMap', this._updateServiceCatalog);

    this.listenToAndRun(this, 'change:intranetInactivityCheckUrl', () => this._resetLogoutTimer());
    this.listenToAndRun(this, 'change:intranetInactivityDuration', () => this._resetLogoutTimer());
    this.listenTo(this.spark, 'user-activity', () => { this.lastUserActivityDate = Date.now(); });
  },

  /**
   * Don't log the features object
   * @param {number} depth
   * @returns {Object}
   */
  inspect(depth) {
    return util.inspect(omit(this.serialize(), 'features'), {depth});
  },

  isPreDiscoveryService(service) {
    // The Promise.resolve here is temporary. A future PR will make the
    // corresponding _ method async to allow for lazy device registration
    return Promise.resolve(this._isService(this.config.preDiscoveryServices, service));
  },

  isPreDiscoveryServiceUrl(uri) {
    // The Promise.resolve here is temporary. A future PR will make the
    // corresponding _ method async to allow for lazy device registration
    return Promise.resolve(this._isServiceUrl(this.config.preDiscoveryServices, uri));
  },

  @waitForValue('@')
  isService(service) {
    return this._isService(this.services, service)
      .then((_isService) => _isService || this.isPreDiscoveryService(service));
  },

  @waitForValue('@')
  isServiceUrl(uri) {
    // The Promise.resolve here is temporary. A future PR will make the
    // corresponding _ method async to allow for lazy device registration
    return Promise.resolve(this._isServiceUrl(this.services, uri));
  },

  @waitForValue('@')
  isSpecificService(service, key) {
    if (key === service) {
      return Promise.resolve(true);
    }

    return this.getServiceUrl(service)
      .then((serviceUrl) => key.includes(serviceUrl));
  },

  _getServiceUrl(target, service) {
    /* istanbul ignore if */
    if (!target) {
      return Promise.reject(new Error('`target` is a required parameter'));
    }

    if (!service) {
      return Promise.reject(new Error('`service` is a required parameter'));
    }

    const feature = this.features.developer.get('web-ha-messaging');
    if (feature && feature.value) {
      const s = this.serviceCatalog.get(`${service}ServiceUrl`);
      if (s) {
        return Promise.resolve(s.url);
      }
    }

    return Promise.resolve(target[`${service}ServiceUrl`]);
  },

  _isService(target, service) {
    return this._getServiceUrl(target, service)
      .then((url) => Boolean(url));
  },

  _isServiceUrl(target, uri) {
    if (!uri) {
      return Promise.reject(new Error('`uri` is a required parameter'));
    }

    for (const value of Object.values(target)) {
      if (value && uri.startsWith(value)) {
        return Promise.resolve(true);
      }
    }

    return Promise.resolve(false);
  },

  @oneFlight
  @waitForValue('@')
  refresh() {
    this.logger.info('device: refreshing');

    if (!this.registered) {
      this.logger.info('device: device not registered, registering');
      return this.register();
    }

    const body = omit(this.serialize(), 'features', 'mediaClusters');
    if (this.config.ephemeral) {
      body.ttl = this.config.ephemeralDeviceTTL;
    }

    return this.request({
      method: 'PUT',
      uri: this.url,
      body
    })
      .then((res) => this._processRegistrationSuccess(res))
      .catch((reason) => {
        if (reason.statusCode === 404) {
          // If we get a 404, it means the device is no longer valid and we need
          // to register a new one.
          this.logger.info('device: refresh failed with 404, attempting to register new device');
          this.clear();
          return this.register();
        }
        return Promise.reject(reason);
      });
  },

  @oneFlight
  @waitForValue('@')
  register() {
    /* eslint no-invalid-this: [0] */
    this.logger.info('device: registering');

    if (this.registered) {
      this.logger.info('device: device already registered, refreshing');
      return this.refresh();
    }

    const body = this.config.defaults;
    if (this.config.ephemeral) {
      body.ttl = this.config.ephemeralDeviceTTL;
    }

    return this.request({
      method: 'POST',
      service: 'wdm',
      resource: 'devices',
      body
    })
      .then((res) => this._processRegistrationSuccess(res));
  },

  @oneFlight
  @waitForValue('@')
  unregister() {
    this.logger.info('device: unregistering');

    if (!this.url) {
      this.logger.warn('device: not registered');
      return Promise.resolve();
    }

    return this.request({
      uri: this.url,
      method: 'DELETE'
    })
      .then(() => this.clear());
  },

  clear(...args) {
    clearTimeout(this.refreshTimer);
    Reflect.apply(SparkPlugin.prototype.clear, this, args);
  },

  _processRegistrationSuccess(res) {
    this.logger.info('device: received registration payload');
    this.set(res.body);
    if (this.config.ephemeral) {
      this.logger.info('device: enqueing device refresh');
      const delay = (this.config.ephemeralDeviceTTL / 2 + 60) * 1000;
      this.refreshTimer = safeSetTimeout(() => this.refresh(), delay);
    }
  },

  _updateServiceCatalog(newRegistration) {
    const feature = this.features.developer.get('web-ha-messaging');
    if (feature && feature.value) {
      if (newRegistration.serviceHostMap && newRegistration.serviceHostMap.hostCatalog) {
        Object.keys(newRegistration.services).forEach((service) => {
          const uri = newRegistration.services[service];
          const u = Url.parse(uri);
          const hosts = newRegistration.serviceHostMap.hostCatalog[u.host];
          this.serviceCatalog.set({
            service,
            defaultUrl: uri,
            availableHosts: hosts || []
          }, {remove: false});
        });
        this.trigger('serviceCatalogUpdated');
      }
      else {
        // if user has old device in localStorage, refresh device
        this.refresh();
      }
    }
  },

  _resetLogoutTimer() {
    clearTimeout(this.logoutTimer);
    this.unset('logoutTimer');
    if (this.config.enableInactivityEnforcement && this.intranetInactivityCheckUrl && this.intranetInactivityDuration) {
      this.once('change:lastUserActivityDate', () => this._resetLogoutTimer());

      const timer = safeSetTimeout(() => {
        this.spark.request({
          headers: {
            'cisco-no-http-redirect': null,
            'spark-user-agent': null,
            trackingid: null
          },
          method: 'GET',
          uri: this.intranetInactivityCheckUrl
        })
          .catch(() => {
            this.logger.info('device: did not reach internal ping endpoint; logging out after inactivity on a public network');
            return this.spark.logout();
          })
          .catch((reason) => {
            this.logger.warn('device: logout failed', reason);
          });
      }, this.intranetInactivityDuration * 1000);

      this.logoutTimer = timer;
    }
  }
});

export default Device;
