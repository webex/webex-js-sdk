/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import AmpCollection from 'ampersand-collection';
import ServiceModel from './service-model';

/**
 * Collection of catalog services parsed from wdm registration.services and
 * registration.serviceHostMap.hostCatalog
 * @class
 */
const ServiceCollection = AmpCollection.extend({
  mainIndex: 'service',
  model: ServiceModel,

  /**
   * Mark the current host as failed and grab another url for connection
   * @param {string} uri Mark the host of this url as fail
   * @returns {string} new Url for connection
   */
  markFailedAndCycleUrl(uri) {
    if (!uri) {
      return Promise.reject(new Error('`uri` is a required parameter'));
    }

    return this.inferServiceFromUrl(uri)
      .then((service) => {
        service.markHostFailed(uri);
        return service.cycleNextHost()
          .then(() => service.url);
      });
  },

  /**
   * Reset the available hosts if we are done trying all the host URLs
   * @param {string} uri to fetch the available hosts
   * @returns {string} new Url for connection
   */
  resetAllAndRetry(uri) {
    if (!uri) {
      return Promise.reject(new Error('`uri` is a required parameter'));
    }

    return this.inferServiceFromUrl(uri)
      .then((service) => {
        service.resetAllHosts();
        return service.url;
      });
  },

  /**
   * Find out what service this url belongs to (by looking at the host name)
   * @param {string} uri
   * @returns {Promise<ServiceModel>}
   */
  inferServiceFromUrl(uri) {
    const services = this.filter((service) => service.doesUrlBelongToService(uri));
    if (services.length >= 1) {
      return Promise.resolve(services[0]);
    }

    return Promise.reject(new Error(`Unable to infer service for this url ${uri}`));
  },

  /**
   * Find out what service this url belongs to, this returns the service name
   * instead of the service object
   * @param {string} uri Mark the host of this url as fail
   * @returns {Promise<ServiceModel.Service>}
   */
  inferServiceNameFromUrl(uri) {
    return this.inferServiceFromUrl(uri)
      .then((service) => service.service);
  }
});

export default ServiceCollection;
