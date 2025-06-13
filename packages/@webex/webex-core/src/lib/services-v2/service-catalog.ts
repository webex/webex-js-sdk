import AmpState from 'ampersand-state';

import {union} from 'lodash';
import ServiceDetail from './service-detail';
import {IServiceDetail} from './types';

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
   * @returns {Array<IServiceDetail>} - An array of service details.
   */
  _getAllServiceDetails(serviceGroup: string): Array<IServiceDetail> {
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
   * class object based on its id.
   * @param {string} clusterId
   * @param {string} [serviceGroup]
   * @returns {IServiceDetail}
   */
  _getServiceDetail(clusterId: string, serviceGroup: string): IServiceDetail | undefined {
    const serviceDetails = this._getAllServiceDetails(serviceGroup);

    return serviceDetails.find((serviceDetail: IServiceDetail) => serviceDetail.id === clusterId);
  },

  /**
   * @private
   * Safely load one or more `ServiceDetail`s into this `ServiceCatalog` instance.
   * @param {string} serviceGroup
   * @param  {Array<ServiceDetail>} serviceDetails
   * @returns {void}
   */
  _loadServiceDetails(serviceGroup: string, serviceDetails: Array<IServiceDetail>): void {
    // declare namespaces outside of loop
    let existingService: IServiceDetail | undefined;

    serviceDetails.forEach((service) => {
      existingService = this._getServiceDetail(service.id, serviceGroup);

      if (!existingService) {
        this.serviceGroups[serviceGroup].push(service);
      }
    });
  },

  /**
   * @private
   * Safely unload one or more `ServiceDetail`s into this `Services` instance
   * @param {string} serviceGroup
   * @param  {Array<ServiceDetail>} serviceDetails
   * @returns {void}
   */
  _unloadServiceDetails(serviceGroup: string, serviceDetails: Array<IServiceDetail>): void {
    // declare namespaces outside of loop
    let existingService: IServiceDetail | undefined;

    serviceDetails.forEach((service) => {
      existingService = this._getServiceDetail(service.id, serviceGroup);

      if (existingService) {
        this.serviceGroups[serviceGroup].splice(
          this.serviceGroups[serviceGroup].indexOf(existingService),
          1
        );
      }
    });
  },

  /**
   * Clear all collected catalog data and reset catalog status.
   *
   * @returns {void}
   */
  clean(): void {
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
   * @returns {string | undefined} - ClusterId of a given url
   */
  findClusterId(url: string): string | undefined {
    try {
      const incomingUrlObj = new URL(url);
      const allServiceDetails = this._getAllServiceDetails();

      return allServiceDetails.find((serviceDetail: IServiceDetail) =>
        serviceDetail.serviceUrls.find(({host}) => host === incomingUrlObj.host)
      )?.id;
    } catch {
      // If the URL is invalid or can't be found, return undefined
      return undefined;
    }
  },

  /**
   * Search over all service groups and return a service value from a provided
   * clusterId.
   * @param {object} params
   * @param {string} params.clusterId - clusterId of found service
   * @param {string} [params.serviceGroup] - specify service group
   * @returns {object} service
   * @returns {string} service.name
   * @returns {string} service.url
   */
  findServiceFromClusterId(
    {clusterId, serviceGroup} = {} as {clusterId: string; serviceGroup: string}
  ): {name: string; url: string} | undefined {
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
   * @returns {IServiceDetail} - ServiceDetail assocated with provided url
   */
  findServiceDetailFromUrl(url: string): IServiceDetail | undefined {
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
  findAllowedDomain(url: string): string {
    try {
      const urlObj = new URL(url);

      return this.allowedDomains.find((allowedDomain) => urlObj.host.includes(allowedDomain));
    } catch {
      // If the URL is invalid or can't be found, return undefined
      return undefined;
    }
  },

  /**
   * Get a service url from the current services list by name.
   * @param {string} clusterId
   * @param {string} serviceGroup
   * @returns {string}
   */
  get(clusterId: string, serviceGroup: string): string | undefined {
    const serviceDetail = this._getServiceDetail(clusterId, serviceGroup);

    return serviceDetail ? serviceDetail.get() : undefined;
  },

  /**
   * Get the current allowed domains list.
   *
   * @returns {Array<string>} - the current allowed domains list.
   */
  getAllowedDomains(): Array<string> {
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
  markFailedServiceUrl(url: string): string | undefined {
    const serviceDetails = this._getAllServiceDetails();

    const serviceDetailWithFailedHost = serviceDetails.find((serviceDetail: IServiceDetail) =>
      serviceDetail.failHost(url)
    );

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
  setAllowedDomains(allowedDomains: Array<string>): void {
    this.allowedDomains = [...allowedDomains];
  },

  /**
   *
   * @param {Array<string>} newAllowedDomains - new allowed domains to add to existing set of allowed domains
   * @returns {void}
   */
  addAllowedDomains(newAllowedDomains: Array<string>): void {
    this.allowedDomains = union(this.allowedDomains, newAllowedDomains);
  },

  /**
   * Update the current list of `ServiceDetail`s against a provided
   * service hostmap.
   * @emits ServiceCatalog#preauthorized
   * @emits ServiceCatalog#postauthorized
   * @param {string} serviceGroup
   * @param {Array<IServiceDetail>} serviceDetails
   * @returns {void}
   */
  updateServiceGroups(serviceGroup: string, serviceDetails: Array<IServiceDetail>) {
    const currentServiceDetails = this.serviceGroups[serviceGroup];

    const unusedServicesDetails = currentServiceDetails.filter((serviceDetail) =>
      serviceDetails.every(({id}) => id !== serviceDetail.id)
    );

    this._unloadServiceDetails(serviceGroup, unusedServicesDetails);

    serviceDetails.forEach((serviceObj) => {
      const serviceDetail = this._getServiceDetail(serviceObj.id, serviceGroup);

      if (serviceDetail) {
        serviceDetail.serviceUrls = serviceObj.serviceUrls || [];
      } else {
        this._loadServiceDetails(serviceGroup, [new ServiceDetail(serviceObj)]);
      }
    });

    this.status[serviceGroup].ready = true;
    this.trigger(serviceGroup);
  },

  /**
   * Wait until the service catalog is available,
   * or reject after a timeout of 60 seconds.
   * @param {string} serviceGroup
   * @param {number} [timeout] - in seconds
   * @returns {Promise<void>}
   */
  waitForCatalog(serviceGroup: string, timeout: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
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
