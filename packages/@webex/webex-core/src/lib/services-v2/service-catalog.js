import Url from 'url';

import AmpState from 'ampersand-state';

import {union} from 'lodash';
import Service from './service';

/* eslint-disable no-underscore-dangle */
/**
 * @class
 */
const ServiceCatalog = AmpState.extend({
  namespace: 'ServiceCatalog',

  props: {
    serviceGroups: [
      'object',
      true,
      () => ({
        discovery: [],
        override: [],
        preauth: [],
        postauth: [],
        signin: [],
      }),
    ],
    status: [
      'object',
      true,
      () => ({
        discovery: {
          ready: false,
          collecting: false,
        },
        override: {
          ready: false,
          collecting: false,
        },
        preauth: {
          ready: false,
          collecting: false,
        },
        postauth: {
          ready: false,
          collecting: false,
        },
        signin: {
          ready: false,
          collecting: false,
        },
      }),
    ],
    isReady: ['boolean', false, false],
    allowedDomains: ['array', false, () => []],
  },

  /**
   * @private
   * Search the service url array to locate a `Service`
   * class object based on its name.
   * @param {string} name
   * @param {string} [serviceGroup]
   * @returns {Service}
   */
  _getUrl(name, serviceGroup) {
    const serviceUrls =
      typeof serviceGroup === 'string'
        ? this.serviceGroups[serviceGroup] || {}
        : {
            ...this.serviceGroups.override,
            ...this.serviceGroups.postauth,
            ...this.serviceGroups.signin,
            ...this.serviceGroups.preauth,
            ...this.serviceGroups.discovery,
          };

    return Object.values(serviceUrls).filter((serviceUrl) => serviceUrl.serviceName === name);
  },

  /**
   * @private
   * Generate an array of `Service`s that is organized from highest auth
   * level to lowest auth level.
   * @returns {Array<Service>} - array of `Service`s
   */
  _listServiceUrls() {
    return [
      ...this.serviceGroups.override,
      ...this.serviceGroups.postauth,
      ...this.serviceGroups.signin,
      ...this.serviceGroups.preauth,
      ...this.serviceGroups.discovery,
    ];
  },

  /**
   * Clear all collected catalog data and reset catalog status.
   *
   * @returns {void}
   */
  clean() {
    this.serviceGroups.preauth.length = 0;
    this.serviceGroups.signin.length = 0;
    this.serviceGroups.postauth.length = 0;
    this.status.preauth = {ready: false};
    this.status.signin = {ready: false};
    this.status.postauth = {ready: false};
  },

  /**
   * Search over all service groups to find a cluster id based
   * on a given url.
   * @param {string} url - Must be parsable by `Url`
   * @returns {string} - ClusterId of a given url
   */
  findClusterId(url) {
    const incomingUrlObj = Url.parse(url);
    let serviceUrlObj;

    for (const key of Object.keys(this.serviceGroups)) {
      for (const service of this.serviceGroups[key]) {
        serviceUrlObj = Url.parse(service.defaultUrl);

        for (const host of service.hosts) {
          if (incomingUrlObj.hostname === host.host && host.id) {
            return host.id;
          }
        }

        if (serviceUrlObj.hostname === incomingUrlObj.hostname && service.hosts.length > 0) {
          // no exact match, so try to grab the first home cluster
          for (const host of service.hosts) {
            if (host.homeCluster) {
              return host.id;
            }
          }

          // no match found still, so return the first entry
          return service.hosts[0].id;
        }
      }
    }

    return undefined;
  },

  /**
   * Search over all service groups and return a service value from a provided
   * clusterId. Currently, this method will return either a service name, or a
   * service url depending on the `value` parameter. If the `value` parameter
   * is set to `name`, it will return a service name to be utilized within the
   * Services plugin methods.
   * @param {object} params
   * @param {string} params.clusterId - clusterId of found service
   * @param {boolean} [params.priorityHost = true] - returns priority host url if true
   * @param {string} [params.serviceGroup] - specify service group
   * @returns {object} service
   * @returns {string} service.name
   * @returns {string} service.url
   */
  findServiceFromClusterId({clusterId, priorityHost = true, serviceGroup} = {}) {
    const serviceUrls =
      typeof serviceGroup === 'string'
        ? this.serviceGroups[serviceGroup] || []
        : [
            ...this.serviceGroups.override,
            ...this.serviceGroups.postauth,
            ...this.serviceGroups.signin,
            ...this.serviceGroups.preauth,
            ...this.serviceGroups.discovery,
          ];

    const identifiedServiceUrl = serviceUrls.find((serviceUrl) =>
      serviceUrl.hosts.find((host) => host.id === clusterId)
    );

    if (identifiedServiceUrl) {
      return {
        name: identifiedServiceUrl.name,
        url: identifiedServiceUrl.get(priorityHost, clusterId),
      };
    }

    return undefined;
  },

  /**
   * Find a service based on the provided url.
   * @param {string} url - Must be parsable by `Url`
   * @returns {Service} - Service assocated with provided url
   */
  findServiceUrlFromUrl(url) {
    const serviceUrls = [
      ...this.serviceGroups.discovery,
      ...this.serviceGroups.preauth,
      ...this.serviceGroups.signin,
      ...this.serviceGroups.postauth,
      ...this.serviceGroups.override,
    ];

    return serviceUrls.find((serviceUrl) => {
      // Check to see if the URL we are checking starts with the default URL
      if (url.startsWith(serviceUrl.defaultUrl)) {
        return true;
      }

      // If not, we check to see if the alternate URLs match
      // These are made by swapping the host of the default URL
      // with that of an alternate host
      for (const host of serviceUrl.hosts) {
        const alternateUrl = new URL(serviceUrl.defaultUrl);
        alternateUrl.host = host.host;

        if (url.startsWith(alternateUrl.toString())) {
          return true;
        }
      }

      return false;
    });
  },

  /**
   * Finds an allowed domain that matches a specific url.
   *
   * @param {string} url - The url to match the allowed domains against.
   * @returns {string} - The matching allowed domain.
   */
  findAllowedDomain(url) {
    const urlObj = Url.parse(url);

    if (!urlObj.host) {
      return undefined;
    }

    return this.allowedDomains.find((allowedDomain) => urlObj.host.includes(allowedDomain));
  },

  /**
   * Get a service url from the current services list by name.
   * @param {string} name
   * @param {boolean} priorityHost
   * @param {string} serviceGroup
   * @returns {string}
   */
  get(name, priorityHost, serviceGroup) {
    const serviceUrl = this._getUrl(name, serviceGroup);

    return serviceUrl ? serviceUrl.get(priorityHost) : undefined;
  },

  /**
   * Get the current allowed domains list.
   *
   * @returns {Array<string>} - the current allowed domains list.
   */
  getAllowedDomains() {
    return [...this.allowedDomains];
  },

  /**
   * Creates an object where the keys are the service names
   * and the values are the service urls.
   * @param {boolean} priorityHost - use the highest priority if set to `true`
   * @param {string} [serviceGroup]
   * @returns {Record<string, string>}
   */
  list(priorityHost, serviceGroup) {
    const output = {};

    const serviceUrls =
      typeof serviceGroup === 'string'
        ? this.serviceGroups[serviceGroup] || []
        : [
            ...this.serviceGroups.discovery,
            ...this.serviceGroups.preauth,
            ...this.serviceGroups.signin,
            ...this.serviceGroups.postauth,
            ...this.serviceGroups.override,
          ];

    if (serviceUrls) {
      serviceUrls.forEach((serviceUrl) => {
        output[serviceUrl.name] = serviceUrl.get(priorityHost);
      });
    }

    return output;
  },

  /**
   * Mark a priority host service url as failed.
   * This will mark the host associated with the
   * `Service` to be removed from the its
   * respective host array, and then return the next
   * viable host from the `Service` host array,
   * or the `Service` default url if no other priority
   * hosts are available, or if `noPriorityHosts` is set to
   * `true`.
   * @param {string} url
   * @param {boolean} noPriorityHosts
   * @returns {string}
   */
  markFailedUrl(url, noPriorityHosts) {
    const serviceUrl = this._getUrl(
      Object.keys(this.list()).find((key) => this._getUrl(key).failHost(url))
    );

    if (!serviceUrl) {
      return undefined;
    }

    return noPriorityHosts ? serviceUrl.get(false) : serviceUrl.get(true);
  },

  /**
   * Set the allowed domains for the catalog.
   *
   * @param {Array<string>} allowedDomains - allowed domains to be assigned.
   * @returns {void}
   */
  setAllowedDomains(allowedDomains) {
    this.allowedDomains = [...allowedDomains];
  },

  /**
   *
   * @param {Array<string>} newAllowedDomains - new allowed domains to add to existing set of allowed domains
   * @returns {void}
   */
  addAllowedDomains(newAllowedDomains) {
    this.allowedDomains = union(this.allowedDomains, newAllowedDomains);
  },

  /**
   * Update the current list of `Service`s against a provided
   * service hostmap.
   * @emits ServiceCatalog#preauthorized
   * @emits ServiceCatalog#postauthorized
   * @param {string} serviceGroup
   * @param {object} serviceHostmap
   * @returns {Services}
   */
  updateServices(serviceGroup, serviceHostmap) {
    this.serviceGroups[serviceGroup] = serviceHostmap.map((service) => new Service(service));

    this.status[serviceGroup].ready = true;
    this.trigger(serviceGroup);

    return this;
  },

  /**
   * Wait until the service catalog is available,
   * or reject after a timeout of 60 seconds.
   * @param {string} serviceGroup
   * @param {number} [timeout] - in seconds
   * @returns {Promise<void>}
   */
  waitForCatalog(serviceGroup, timeout) {
    return new Promise((resolve, reject) => {
      if (this.status[serviceGroup].ready) {
        resolve();
      }

      const validatedTimeout = typeof timeout === 'number' && timeout >= 0 ? timeout : 60;

      const timeoutTimer = setTimeout(
        () =>
          reject(
            new Error(
              `services: timeout occured while waiting for '${serviceGroup}' catalog to populate`
            )
          ),
        validatedTimeout * 1000
      );

      this.once(serviceGroup, () => {
        clearTimeout(timeoutTimer);
        resolve();
      });
    });
  },
});
/* eslint-enable no-underscore-dangle */

export default ServiceCatalog;
