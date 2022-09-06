import {
  SERVICE_CATALOGS,
  SERVICE_CATALOGS_ENUM_TYPES
} from './constants';
import ServiceHost from './service-host';

/**
 * The parameter transfer object for {@link ServiceRegistry#mapRemoteCatalog}.
 * This object is shaped to match the object returned from the **U2C** service.
 *
 * @typedef {Record<string, string>} RSL
 * @typedef {Record<string, Array<Record<string, number | string>>>} RHC
 *
 * @typedef {Object} MapRemoteCatalogPTO
 * @property {string} MapRemoteCatalogPTO.catalog - Service catalog name.
 * @property {RSL} MapRemoteCatalogPTO.serviceLinks - Service links.
 * @property {RHC} MapRemoteCatalogPTO.hostCatalog - Service host catalog.
 */

/**
 * Service manipulation filter object for retrieving services within the
 * {@link ServiceRegistry} class.
 *
 * @typedef {Object} HostFilter
 * @property {boolean} [HostFilter.active] - Active state to filter.
 * @property {Array<string> | string} [HostFilter.catalog] - Catalogs to filter.
 * @property {Array<string> | string} [HostFilter.cluster] - Clusters to filter.
 * @property {boolean} [HostFilter.local] - Filter to the user's home cluster.
 * @property {boolean} [HostFilter.priority] - Filter for the highest priority.
 * @property {Array<string> | string} [HostFilter.service] - Services to filter.
 * @property {Array<string> | string} [HostFilter.url] - URL to filter.
 */

/**
 * @class
 * @classdesc - Manages a collection of {@link ServiceHost} class objects.
 */
export default class ServiceRegistry {
  /**
   * Generate a new {@link ServiceHost}.
   *
   * @public
   * @constructor
   * @memberof ServiceHost
   */
  constructor() {
    /**
     * The collection of managed {@link ServiceHost}s.
     *
     * @instance
     * @type {Array<ServiceHost>}
     * @private
     * @memberof ServiceRegistry
     */
    this.hosts = [];
  }

  /**
   * An active, local, and priority mapped record of the current
   * {@link ServiceCatalog#hosts}.
   *
   * @public
   * @memberof ServiceCatalog
   * @type {Record<string, string>}
   */
  get map() {
    // Get a list of active, local, and priority-mapped hosts.
    return this.find({
      active: true,
      local: true,
      priority: true
    }).reduce(
      (map, host) => {
        // Generate a new object to assign the existing map.
        const hostReference = {};

        // Assign the key:value pair for the service and url.
        hostReference[host.service] = host.url;

        // Assign the reference to the map and return.
        return {...map, ...hostReference};
      }, {}
    );
  }

  /**
   * Removes a collection of {@link ServiceHost} class objects from the
   * {@link ServiceRegistry#hosts} array based on the provided
   * {@link HostFilter}.
   *
   * @public
   * @memberof ServiceRegistry
   * @param {HostFilter} filter - The inclusive filter for hosts to remove.
   * @returns {Array<ServiceHost>} - The removed {@link ServiceHost}s.
   */
  clear(filter) {
    // Collect a list of hosts to remove based on the provided filter.
    const removing = this.find(filter);

    // Remove the hosts from the array.
    this.hosts = this.hosts.filter(
      (host) => !removing.includes(host)
    );

    // Return the removed hosts.
    return removing;
  }

  /**
   * Mark a collection of {@link ServiceHost} class objects from the
   * {@link ServiceRegistry#hosts} array as failed based on the provided
   * {@link HostFilter}.
   *
   * @public
   * @memberof ServiceRegistry
   * @param {HostFilter} filter - The inclusive filter for hosts to mark failed.
   * @returns {Array<ServiceHost>} - The {@link ServiceHost}s marked failed.
   */
  failed(filter) {
    // Collect a list of hosts to mark as failed based on the provided filter.
    const failing = this.find(filter);

    // Mark the hosts from the array as failed.
    failing.forEach(
      (host) => {
        host.setStatus({failed: true});
      }
    );

    // Return the marked hosts.
    return failing;
  }

  /**
   * Filter the {@link ServiceRegistry#hosts} array against their active states.
   *
   * @private
   * @memberof ServiceRegistry
   * @param {boolean} [active] - Filter for the host state.
   * @returns {Array<ServiceHost>} - The filtered host array.
   */
  filterActive(active) {
    // Filter the host array if the active requirement is true.
    return (typeof active === 'boolean') ?
      this.hosts.filter((host) => host.active === active) :
      [...this.hosts];
  }

  /**
   * Filter the {@link ServiceRegistry#hosts} array against their assigned
   * catalog values.
   *
   * @private
   * @memberof ServiceRegistry
   * @param {Array<string> | string} [catalog] - Catalogs to filter.
   * @returns {Array<ServiceHost>} - The filtered host array.
   */
  filterCatalog(catalog = []) {
    // Generate a catalog names array based on the provided catalog param.
    const catalogs = (Array.isArray(catalog) ? catalog : [catalog])
      .map((catalogId) => ServiceRegistry.mapCatalogName({
        id: catalogId,
        type: SERVICE_CATALOGS_ENUM_TYPES.STRING
      }) || catalogId);

    // Filter the host array against the catalog names array.
    return (catalogs.length > 0) ?
      this.hosts.filter((host) => catalogs.includes(host.catalog)) :
      [...this.hosts];
  }

  /**
   * Filter the {@link ServiceRegistry#hosts} array against their assigned
   * cluster values.
   *
   * @private
   * @memberof ServiceRegistry
   * @param {Array<string> | string} [cluster] - Clusters to filter for.
   * @returns {Array<ServiceHost>} - The filtered host array.
   */
  filterCluster(cluster = []) {
    // Generate an array of clusters regardless of parameter type.
    const clusters = (Array.isArray(cluster) ? cluster : [cluster]);

    // Filter the host array against the provided clusters.
    return (clusters.length > 0) ?
      this.hosts.filter((host) => clusters.includes(host.id)) :
      [...this.hosts];
  }

  /**
   * Filter the {@link ServiceRegistry#hosts} array against their location in
   * reference to the authenticated user.
   *
   * @private
   * @memberof ServiceRegistry
   * @param {boolean} [local] - Filter for the host location.
   * @returns {Array<ServiceHost>} - The filtered host array.
   */
  filterLocal(local) {
    return (typeof local === 'boolean') ?
      this.hosts.filter((host) => host.local === local) :
      [...this.hosts];
  }

  /**
   * Filter the {@link ServiceRegistry#hosts} array for the highest priority
   * hosts for each specific service.
   *
   * @private
   * @memberof ServiceRegistry
   * @param {boolean} [priority] - Filter for the highest priority
   * @returns {Array<ServiceHost>} - The filtered host array.
   */
  filterPriority(priority) {
    return (priority) ?
      this.hosts.reduce(
        (filteredHosts, currentHost) => {
          // Validate that the current host is not active.
          if (!currentHost.active) {
            return filteredHosts;
          }

          // Determine if the filtered hosts array contains a host from the same
          // host group.
          const foundHost = filteredHosts.find(
            (host) => host.hostGroup === currentHost.hostGroup
          );

          // Validate if a host was found.
          if (!foundHost) {
            filteredHosts.push(currentHost);

            return filteredHosts;
          }

          // Map the found host's catalog to its priority value.
          const foundHostCatalogPriority = ServiceRegistry.mapCatalogName({
            id: foundHost.catalog,
            type: SERVICE_CATALOGS_ENUM_TYPES.NUMBER
          });

          // Map the current host's catalog to its priority value.
          const currentHostCatalogPriority = ServiceRegistry.mapCatalogName({
            id: currentHost.catalog,
            type: SERVICE_CATALOGS_ENUM_TYPES.NUMBER
          });

          // Validate if the found host has a lower priority than the current
          // host.
          if (
            foundHostCatalogPriority < currentHostCatalogPriority ||
            foundHost.priority < currentHost.priority
          ) {
            filteredHosts.splice(filteredHosts.indexOf(foundHost, 1));
            filteredHosts.push(currentHost);
          }

          return filteredHosts;
        }, []
      ) : [...this.hosts];
  }

  /**
   * Filter the {@link ServiceRegistry#hosts} array for hosts with a specified
   * set of service names.
   *
   * @private
   * @memberof ServiceRegistry
   * @param {Array<string> | string} [service] - Services to filter.
   * @returns {Array<ServiceHost>} - The filtered host array.
   */
  filterService(service = []) {
    // Generate an array of services regardless of parameter type.
    const services = (Array.isArray(service) ? service : [service]);

    // Filter the host array against the provided services.
    return (services.length > 0) ?
      this.hosts.filter((host) => services.includes(host.service)) :
      [...this.hosts];
  }

  /**
   * Filter the {@link ServiceRegistry#hosts} array for hosts with a specified
   * set of URLs.
   *
   * @private
   * @memberof ServiceRegistry
   * @param {Array<string> | string} [url] - URL to filter.
   * @returns {Array<ServiceHost>} - The filter host array.
   */
  filterUrl(url = []) {
    // Generate an array of URLs regardless of the parameter type.
    const urls = (Array.isArray(url) ? url : [url]);

    // Filter the host array against the provided URLs.
    return (urls.length > 0) ?
      this.hosts.filter((host) => urls.includes(host.url)) :
      [...this.hosts];
  }

  /**
   * Get an array of {@link ServiceHost}s based on a provided
   * {@link HostFilter} from the {@link ServiceRegistry#hosts} array.
   *
   * @public
   * @memberof ServiceRegistry
   * @param {HostFilter} [filter] - The inclusive filter for hosts to find.
   * @returns {Array<ServiceHost>} - The filtered hosts.
   */
  find({
    active,
    catalog,
    cluster,
    local,
    priority,
    service,
    url
  } = {}) {
    return this.hosts.filter(
      (host) => (
        this.filterActive(active).includes(host) &&
        this.filterCatalog(catalog).includes(host) &&
        this.filterCluster(cluster).includes(host) &&
        this.filterLocal(local).includes(host) &&
        this.filterPriority(priority).includes(host) &&
        this.filterService(service).includes(host) &&
        this.filterUrl(url).includes(host)
      )
    );
  }

  /**
   * Load a formatted array of {@link ServiceHost} constructor parameter
   * transfer objects as instances of {@link ServiceHost} class objects to the
   * {@link ServiceRegistry#hosts} array.
   *
   * @public
   * @memberof ServiceRegistry
   * @param {Array<ServiceHost.ConstructorPTO>} hosts
   * @returns {this}
   */
  load(hosts = []) {
    // Validate that the provided hosts are eligible to be loaded.
    const validHosts = hosts.filter((host) => !!(
      ServiceRegistry.mapCatalogName({
        id: host.catalog,
        type: SERVICE_CATALOGS_ENUM_TYPES.STRING
      })));

    // Load the eligible hosts.
    this.hosts.push(
      ...validHosts.map((loadableHost) => new ServiceHost(loadableHost))
    );

    return this;
  }

  /**
   * Mark a collection of {@link ServiceHost} class objects from the
   * {@link ServiceRegistry#hosts} array as replaced based on the provided
   * {@link HostFilter}.
   *
   * @public
   * @memberof ServiceRegistry
   * @param {HostFilter} filter - The inclusive filter to mark replaced.
   * @returns {Array<ServiceHost>} - The {@link ServiceHost}s marked replaced.
   */
  replaced(filter) {
    // Collect a list of hosts to mark as replaced based on the provided filter.
    const replacing = this.find(filter);

    // Mark the hosts from the array as replaced.
    replacing.forEach(
      (host) => {
        host.setStatus({replaced: true});
      }
    );

    // Return the marked hosts.
    return replacing;
  }

  /**
   * Reset the failed status of a collection of {@link ServiceHost} class
   * objects from the {@link ServiceRegistry#hosts} array based on the provided
   * {@link HostFilter}.
   *
   * @public
   * @memberof ServiceRegistry
   * @param {HostFilter} filter - The inclusive filter of hosts to reset.
   * @returns {Array<ServiceHost>} - The {@link ServiceHost}s that reset.
   */
  reset(filter) {
    // Collect a list of hosts to mark as replaced based on the provided filter.
    const resetting = this.find(filter);

    // Mark the hosts from the array as replaced.
    resetting.forEach(
      (host) => {
        host.setStatus({failed: false});
      }
    );

    // Return the marked hosts.
    return resetting;
  }

  /**
   * Convert a {@link SERVICE_CATALOGS} identifier or value to its associated
   * idenfier or value.
   *
   * @public
   * @static
   * @memberof ServiceRegistry
   * @param {Object} pto - The parameter transfer object.
   * @property {string | number} pto.id - The identifier to convert in the enum.
   * @property {SERVICE_CATALOGS_ENUM_TYPES} pto.type - The desired output.
   * @returns {string|number} - The matching enum value or index.
   */
  static mapCatalogName({id, type}) {
    // Validate that the id is a number.
    if (typeof id === 'number') {
      // Validate that the desired type is a number.
      if (type === SERVICE_CATALOGS_ENUM_TYPES.NUMBER) {
        return (SERVICE_CATALOGS[id] !== undefined) ? id : undefined;
      }

      // Validate that the desired type is a string.
      if (type === SERVICE_CATALOGS_ENUM_TYPES.STRING) {
        return SERVICE_CATALOGS[id];
      }
    }

    // Validate that the id is a string.
    if (typeof id === 'string') {
      // Validate that the desired type is a string.
      if (type === SERVICE_CATALOGS_ENUM_TYPES.STRING) {
        return SERVICE_CATALOGS.includes(id) ? id : undefined;
      }

      // Validate that the desired type is a number.
      if (type === SERVICE_CATALOGS_ENUM_TYPES.NUMBER) {
        return (SERVICE_CATALOGS.includes(id)) ?
          SERVICE_CATALOGS.indexOf(id) :
          undefined;
      }
    }

    return undefined;
  }

  /**
   * Generate a formatted array based on the object received from the **U2C**
   * service for usage in the {@link ServiceRegistry#load} method.
   *
   * @public
   * @static
   * @memberof ServiceRegistry
   * @param {MapRemoteCatalogPTO} pto - The parameter transfer object.
   * @throws - If the target catalog does not exist.
   * @returns {Array<ServiceHost#ServiceHostConstructorPTO>}
   */
  static mapRemoteCatalog({catalog, hostCatalog, serviceLinks}) {
    // Collect the service catalog name if needed.
    const catalogIndex = ServiceRegistry.mapCatalogName({
      id: catalog,
      type: SERVICE_CATALOGS_ENUM_TYPES.STRING
    });

    // Validate that the target catalog exists.
    if (!SERVICE_CATALOGS.includes(catalogIndex)) {
      throw new Error(`service-catalogs: '${catalog}' is not a valid catalog`);
    }

    // Map the remote catalog to a mountable host array.
    return Object.keys(hostCatalog).reduce((output, key) => {
      output.push(
        ...hostCatalog[key].map((host) => ({
          catalog: catalogIndex,
          defaultUri: serviceLinks[host.id.split(':')[3]],
          hostGroup: key,
          id: host.id,
          priority: host.priority,
          uri: host.host
        }))
      );

      return output;
    }, []);
  }
}
