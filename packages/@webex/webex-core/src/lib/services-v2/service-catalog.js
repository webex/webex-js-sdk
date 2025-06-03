import AmpState from 'ampersand-state';

import {union} from 'lodash';
import ServiceDetail from './service-detail';

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
   * Get all service details for a given service group or return all details if no group is specified.
   * @param {string} serviceGroup - The name of the service group to retrieve details for.
   * @returns {Array<ServiceDetail>} - An array of service details.
   */
  _getAllServiceDetails(serviceGroup) {
    const serviceDetails =
      typeof serviceGroup === 'string'
        ? this.serviceGroups[serviceGroup] || []
        : [
            ...this.serviceGroups.override,
            ...this.serviceGroups.postauth,
            ...this.serviceGroups.signin,
            ...this.serviceGroups.preauth,
            ...this.serviceGroups.discovery,
          ];

    return serviceDetails;
  },

  /**
   * @private
   * Search the service details array to locate a `ServiceDetails`
   * class object based on its name.
   * @param {string} clusterId
   * @param {string} [serviceGroup]
   * @returns {ServiceDetail}
   */
  _getServiceDetail(clusterId, serviceGroup) {
    const serviceDetails = this._getAllServiceDetails(serviceGroup);

    return serviceDetails.find((serviceUrl) => serviceUrl.id === clusterId);
  },

  /**
   * @private
   * Safely load one or more `ServiceDetail`s into this `Services` instance.
   * @param {string} serviceGroup
   * @param  {Array<ServiceDetail>} serviceDetails
   * @returns {Services}
   */
  _loadServiceDetails(serviceGroup, serviceDetails) {
    // declare namespaces outside of loop
    let existingService;

    serviceDetails.forEach((service) => {
      existingService = this._getServiceDetail(service.id, serviceGroup);

      if (!existingService) {
        this.serviceGroups[serviceGroup].push(service);
      }
    });

    return this;
  },

  /**
   * @private
   * Safely unload one or more `ServiceDetail`s into this `Services` instance
   * @param {string} serviceGroup
   * @param  {Array<ServiceDetail>} serviceDetails
   * @returns {Services}
   */
  _unloadServiceDetails(serviceGroup, serviceDetails) {
    // declare namespaces outside of loop
    let existingService;

    serviceDetails.forEach((service) => {
      existingService = this._getServiceDetail(service.id, serviceGroup);

      if (existingService) {
        this.serviceGroups[serviceGroup].splice(
          this.serviceGroups[serviceGroup].indexOf(existingService),
          1
        );
      }
    });

    return this;
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
    const incomingUrlObj = new URL(url);
    const allServiceDetails = this._getAllServiceDetails();

    return allServiceDetails.find((serviceDetail) =>
      serviceDetail.serviceUrls.find((serviceUrl) => serviceUrl.host === incomingUrlObj.host)
    )?.id;
  },

  /**
   * Search over all service groups and return a service value from a provided
   * clusterId. Currently, this method will return either a service name, or a
   * service url depending on the `value` parameter. If the `value` parameter
   * is set to `name`, it will return a service name to be utilized within the
   * Services plugin methods.
   * @param {object} params
   * @param {string} params.clusterId - clusterId of found service
   * @param {string} [params.serviceGroup] - specify service group
   * @returns {object} service
   * @returns {string} service.name
   * @returns {string} service.url
   */
  findServiceFromClusterId({clusterId, serviceGroup} = {}) {
    const serviceDetails = this._getServiceDetail(clusterId, serviceGroup);

    if (serviceDetails) {
      return {
        name: serviceDetails.serviceName,
        url: serviceDetails.get(),
      };
    }

    return undefined;
  },

  /**
   * Find a service based on the provided url.
   * @param {string} url - Must be parsable by `Url`
   * @returns {ServiceDetail} - ServiceDetail assocated with provided url
   */
  findServiceUrlFromUrl(url) {
    const serviceDetails = this._getAllServiceDetails();

    return serviceDetails.find(({serviceUrls}) => {
      for (const serviceUrl of serviceUrls) {
        if (url.startsWith(serviceUrl.baseUrl)) {
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
    const urlObj = new URL(url);

    if (!urlObj.host) {
      return undefined;
    }

    return this.allowedDomains.find((allowedDomain) => urlObj.host.includes(allowedDomain));
  },

  /**
   * Get a service url from the current services list by name.
   * @param {string} clusterId
   * @param {string} serviceGroup
   * @returns {string}
   */
  get(clusterId, serviceGroup) {
    const serviceDetail = this._getServiceDetail(clusterId, serviceGroup);

    return serviceDetail ? serviceDetail.get() : undefined;
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
   * Mark a priority host service url as failed.
   * This will mark the host associated with the
   * `ServiceDetail` to be removed from the its
   * respective host array, and then return the next
   * viable host from the `ServiceDetail` host array,
   * or the `ServiceDetail` default url if no other priority
   * hosts are available, or if `noPriorityHosts` is set to
   * `true`.
   * @param {string} url
   * @returns {string}
   */
  markFailedServiceUrl(url) {
    const serviceDetails = this._getAllServiceDetails();

    const serviceDetailWithFailedHost = serviceDetails.find((service) => service.failHost(url));

    // if we couldn't find the url we wanted to fail, return undefined
    if (!serviceDetailWithFailedHost) {
      return undefined;
    }

    return serviceDetailWithFailedHost.get();
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
   * Update the current list of `ServiceDetail`s against a provided
   * service hostmap.
   * @emits ServiceCatalog#preauthorized
   * @emits ServiceCatalog#postauthorized
   * @param {string} serviceGroup
   * @param {object} serviceHostmap
   * @returns {Services}
   */
  updateServiceGroups(serviceGroup, serviceHostmap) {
    const currentServiceDetails = this.serviceGroups[serviceGroup];

    const unusedServicesDetails = currentServiceDetails.filter((serviceDetail) =>
      serviceHostmap.every((item) => item.id !== serviceDetail.id)
    );

    this._unloadServiceDetails(serviceGroup, unusedServicesDetails);

    serviceHostmap.forEach((serviceObj) => {
      const service = this._getServiceDetail(serviceObj.id, serviceGroup);

      if (service) {
        service.serviceUrls = serviceObj.serviceUrls || [];
      } else {
        this._loadServiceDetails(serviceGroup, [new ServiceDetail(serviceObj)]);
      }
    });

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

export default ServiceCatalog;
