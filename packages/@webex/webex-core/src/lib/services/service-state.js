import {SERVICE_CATALOGS} from './constants';

/**
 * The state of a specific catalog to be used by {@link ServiceState}.
 *
 * @typedef {Record<string, boolean>} CatalogState
 * @property {boolean} CatalogState.collecting - If the catalog is collecting.
 * @property {boolean} CatalogState.ready - If the catalog is ready.
 */

/**
 * @class
 * @classdesc - Manages the state of the service catalogs for a webex instance.
 */
export default class ServiceState {
  /**
   * Generate a new {@link ServiceState}.
   *
   * @public
   * @constructor
   * @memberof ServiceState
   */
  constructor() {
    // Iterate over the possible catalog names and generate their states.
    SERVICE_CATALOGS.forEach(
      (catalog) => {
        this[catalog] = ServiceState.generateCatalogState();
      }
    );
  }

  /**
   * Set a catalog to be collecting or not.
   *
   * @public
   * @memberof ServiceState
   * @param {string} catalog - Catalog to target.
   * @param {boolean} collecting - If the target is collecting or not.
   * @returns {undefined}
   */
  setCollecting(catalog, collecting) {
    // Validate that the catalog state exists.
    if (this[catalog]) {
      // Set the 'collecting' status of the catalog state.
      this[catalog].collecting = collecting;
    }
  }

  /**
   * Set a catalog to be ready or not.
   *
   * @public
   * @memberof ServiceState
   * @param {string} catalog - Catalog to target.
   * @param {boolean} ready - If the target is ready or not.
   * @returns {undefined}
   */
  setReady(catalog, ready) {
    // Validate that the catalog state exists.
    if (this[catalog]) {
      // Set the 'ready' status of the catalog state.
      this[catalog].ready = ready;
    }
  }

  /**
   * Generate a {@link CatalogState}.
   *
   * @public
   * @static
   * @memberof ServiceState
   * @returns {CatalogState} - The generated {@link CatalogState}.
   */
  static generateCatalogState() {
    return {
      collecting: false,
      ready: false
    };
  }
}
