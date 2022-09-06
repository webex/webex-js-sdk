import Url from 'url';

import {SERVICE_CATALOGS} from './constants';

/**
 * The parameter transfer object for {@link ServiceHost#constructor}.
 *
 * @typedef {Object} ServiceHostConstructorPTO
 * @property {string} ServiceHostConstructorPTO.catalog - The host's catalog.
 * @property {string} ServiceHostConstructorPTO.defaultUri - The host's default.
 * @property {string} ServiceHostConstructorPTO.hostGroup - The host's group.
 * @property {string} ServiceHostConstructorPTO.id - The host's clusterId.
 * @property {number} ServiceHostConstructorPTO.priority - The host's priority.
 * @property {string} ServiceHostConstructorPTO.uri - The host's uri.
 */

/**
 * The parameter transfer object for {@link ServiceHost#polyGenerate}.
 *
 * @typedef {Object} ServiceHostPolyGeneratePTO
 * @property {string} ServiceHostPolyGeneratePTO.catalog - The target catalog.
 * @property {string} ServiceHostPolyGeneratePTO.name - The service name.
 * @property {string} ServiceHostPolyGeneratePTO.url - The service url.
 */

/**
 * @class
 * @classdesc - Manages a single service host and its associated data.
 */
export default class ServiceHost {
  /**
   * Generate a new {@link ServiceHost}.
   *
   * @public
   * @constructor
   * @memberof ServiceHost
   * @param {ServiceHostConstructorPTO} pto
   */
  constructor(pto) {
    // Validate the parameter transfer object.
    ServiceHost.validate(pto);

    // Map the parameter transfer object to the class object.
    /**
     * The catalog name that the {@link ServiceHost} is associated with.
     *
     * @instance
     * @type {string}
     * @public
     * @memberof ServiceHost
     */
    this.catalog = pto.catalog;

    /**
     * The default URI for the {@link ServiceHost}.
     *
     * @instance
     * @type {string}
     * @public
     * @memberof ServiceHost
     */
    this.default = pto.defaultUri;

    /**
     * The host group that the {@link ServiceHost} is associated with.
     *
     * @instance
     * @type {string}
     * @public
     * @memberof ServiceHost
     */
    this.hostGroup = pto.hostGroup;

    /**
     * The cluster ID of the {@link ServiceHost}.
     *
     * @instance
     * @type {string}
     * @public
     * @memberof ServiceHost
     */
    this.id = pto.id;

    /**
     * The priority value of the {@link ServiceHost}. The lower the number, the
     * higher the priority.
     *
     * @instance
     * @type {number}
     * @public
     * @memberof ServiceHost
     */
    this.priority = pto.priority;

    /**
     * The host uri of the {@link ServiceHost}.
     *
     * @instance
     * @type {string}
     * @public
     * @memberof ServiceHost
     */
    this.uri = pto.uri;

    // Generate flags.
    /**
     * If the {@link ServiceHost} is marked as failed.
     *
     * @instance
     * @type {boolean}
     * @protected
     * @memberof ServiceHost
     */
    this.failed = false;

    /**
     * If the {@link ServiceHost} is marked as replaced.
     *
     * @instance
     * @type {boolean}
     * @protected
     * @memberof ServiceHost
     */
    this.replaced = false;
  }

  /**
   * If the {@link ServiceHost} is in an active state.
   *
   * @public
   * @memberof ServiceHost
   * @type {boolean} - `true` if the service is active and usable.
   */
  get active() {
    // Validate that the `ServiceHost` was not marked as failed or replaced.
    return (!this.failed && !this.replaced);
  }

  /**
   * If the host is local to the user's cluster.
   *
   * @public
   * @memberof ServiceHost
   * @type {boolean} - If the host is local.
   */
  get local() {
    return this.default.includes(this.hostGroup);
  }

  /**
   * The service value.
   *
   * @public
   * @memberof ServiceHost
   * @type {string} - The service value.
   */
  get service() {
    return this.id.split(':')[3];
  }

  /**
   * The formatted url for the host.
   *
   * @public
   * @memberof ServiceHost
   * @type {string} - The service url.
   */
  get url() {
    // Generate a url object from the default url.
    const urlObj = Url.parse(this.default);

    // Format the host of the generated url object.
    urlObj.host = `${this.uri}${urlObj.port ? `:${urlObj.port}` : ''}`;

    // Assign the formatted url to this.
    return Url.format(urlObj);
  }

  /**
   * Set one or more of the status properties of the class object.
   *
   * @public
   * @memberof ServiceHost
   * @param {Object} pto - The parameter transfer object.
   * @property {boolean} [pto.failed] - The failed status to set.
   * @property {boolean} [pto.replaced] - the replaced status to set.
   * @returns {this}
   */
  setStatus({failed, replaced}) {
    if (failed !== undefined) {
      this.failed = failed;
    }

    if (replaced !== undefined) {
      this.replaced = replaced;
    }

    return this;
  }

  /**
   * Generate a service host using only a catalog, name, and URL.
   *
   * @public
   * @static
   * @memberof ServiceHost
   * @param {ServiceHostPolyGeneratePTO} pto
   * @returns {ServiceHost} - The generated service host.
   */
  static polyGenerate({catalog, name, url}) {
    return new ServiceHost({
      catalog,
      defaultUri: url,
      hostGroup: Url.parse(url).host,
      id: (name) ? `poly-head:poly-group:poly-cluster:${name}` : undefined,
      priority: 1,
      uri: Url.parse(url).host
    });
  }

  /**
   * Validate that a constructor parameter transfer object is valid.
   *
   * @public
   * @static
   * @memberof ServiceHost
   * @param {ServiceHostConstructorPTO} pto
   * @throws - If the parameter transfer object is not valid.
   * @returns {undefined}
   */
  static validate({
    catalog,
    defaultUri,
    hostGroup,
    id,
    priority,
    uri
  }) {
    // Generate error-throwing method.
    const throwError = (msg) => {
      throw new Error(`service-host: invalid constructor parameters, ${msg}`);
    };

    // Validate the catalog property.
    if (!SERVICE_CATALOGS.includes(catalog)) {
      throwError('\'catalog\' must be a string');
    }

    // Validate the `defaultUri` property.
    if (typeof defaultUri !== 'string') {
      throwError('\'defaultUri\' must be a string');
    }

    // Validate the `hostGroup` property.
    if (typeof hostGroup !== 'string') {
      throwError('\'hostGroup\' must be a string');
    }

    // Validate the `id` property.
    if (typeof id !== 'string' || id.split(':').length !== 4) {
      throwError('\'id\' must be a string that contains 3 \':\' characters');
    }

    // Validate the `priority` property.
    if (typeof priority !== 'number') {
      throwError('\'priority\' must be a number');
    }

    // Validate the `uri` property.
    if (typeof uri !== 'string') {
      throwError('\'uri\' must be a string');
    }
  }
}
