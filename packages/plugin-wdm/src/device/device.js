/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import {oneFlight} from '@ciscospark/common';
import {SparkPlugin} from '@ciscospark/spark-core';
import {omit} from 'lodash';
import util from 'util';
import FeaturesModel from './features-model';
import {persist, waitForValue} from '@ciscospark/spark-core';

const Device = SparkPlugin.extend({
  children: {
    features: FeaturesModel
  },

  idAttribute: `url`,

  namespace: `Device`,

  props: {
    modificationTime: `string`,
    services: {
      // Even though @jodykstr will tell you the docs claim you don't need to
      // initialize `object` properties, the docs lie.
      default() {
        return {};
      },
      type: `object`
    },
    url: `string`,
    userId: `string`,
    webSocketUrl: `string`
  },

  derived: {
    registered: {
      deps: [`url`],
      fn() {
        return Boolean(this.url);
      }
    }
  },

  @waitForValue(`@`)
  getServiceUrl(service) {
    return this._getServiceUrl(this.services, service)
      .then((isServiceUrl) => isServiceUrl || this.getPreDiscoveryServiceUrl(service));
  },

  getPreDiscoveryServiceUrl(service) {
    // The Promise.resolve here is temporary. A future PR will make the
    // corresponding _ method async to allow for lazy device registration
    return Promise.resolve(this._getServiceUrl(this.config.preDiscoveryServices, service));
  },

  @persist
  initialize(...args) {
    Reflect.apply(SparkPlugin.prototype.initialize, this, args);

    // Propagate change(:[attribute]) events from collections
    [`developer`, `entitlement`, `user`].forEach((collectionName) => {
      this.features.on(`change:${collectionName}`, (model, value, options) => {
        this.trigger(`change`, this, options);
        this.trigger(`change:features`, this, this.features, options);
      });
    });
  },

  /**
   * Don't log the features object
   * @param {number} depth
   * @returns {Object}
   */
  inspect(depth) {
    return util.inspect(omit(this.serialize(), `features`), {depth});
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

  @waitForValue(`@`)
  isService(service) {
    return this._isService(this.services, service)
      .then((_isService) => _isService || this.isPreDiscoveryService(service));
  },

  @waitForValue(`@`)
  isServiceUrl(uri) {
    // The Promise.resolve here is temporary. A future PR will make the
    // corresponding _ method async to allow for lazy device registration
    return Promise.resolve(this._isServiceUrl(this.services, uri));
  },

  @waitForValue(`@`)
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
      return Promise.reject(new Error(`\`target\` is a required parameter`));
    }

    if (!service) {
      return Promise.reject(new Error(`\`service\` is a required parameter`));
    }

    return Promise.resolve(target[`${service}ServiceUrl`]);
  },

  _isService(target, service) {
    return this._getServiceUrl(target, service)
      .then((url) => Boolean(url));
  },

  _isServiceUrl(target, uri) {
    if (!uri) {
      return Promise.reject(new Error(`\`uri\` is a required parameter`));
    }

    for (const key in target) {
      if (target[key] && uri.indexOf(target[key]) === 0) {
        return Promise.resolve(true);
      }
    }

    return Promise.resolve(false);
  },

  @oneFlight
  @waitForValue(`@`)
  refresh() {
    this.logger.info(`device: refreshing`);

    if (!this.registered) {
      this.logger.info(`device: device not registered, refreshing`);
      return this.register();
    }

    this.logger.info(`device: refreshing`);

    return this.request({
      method: `PUT`,
      uri: this.url,
      body: omit(this.serialize(), `features`, `mediaClusters`)
    })
      .then((res) => this._processRegistrationSuccess(res))
      .catch((reason) => {
        if (reason.statusCode === 404) {
          // If we get a 404, it means the device is no longer valid and we need
          // to register a new one.
          this.logger.info(`device: refresh failed with 404, attempting to register new device`);
          this.clear();
          return this.register();
        }
        return Promise.reject(reason);
      });
  },

  @oneFlight
  @waitForValue(`@`)
  register() {
    /* eslint no-invalid-this: [0] */
    this.logger.info(`device: registering`);

    if (this.registered) {
      this.logger.info(`device: device already registered, refreshing`);
      return this.refresh();
    }

    return this.request({
      method: `POST`,
      service: `wdm`,
      resource: `devices`,
      body: this.config.defaults
    })
      .then((res) => this._processRegistrationSuccess(res));
  },

  _processRegistrationSuccess(res) {
    this.logger.info(`device: received registration payload`);
    this.set(res.body);
  }
});

export default Device;
