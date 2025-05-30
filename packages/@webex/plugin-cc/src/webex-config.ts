import {MemoryStoreAdapter} from '@webex/webex-core';

/**
 * Default Webex SDK configuration for Contact Center integration.
 *
 * @public
 * @example
 * import webexConfig from './webex-config';
 * const hydraUrl = webexConfig.hydra;
 */
export default {
  /**
   * URL for the Hydra API service.
   * @type {string}
   * @public
   * @default process.env.HYDRA_SERVICE_URL || 'https://api.ciscospark.com/v1'
   */
  hydra: process.env.HYDRA_SERVICE_URL || 'https://api.ciscospark.com/v1',
  /**
   * Alias for the Hydra API service URL.
   * @type {string}
   * @public
   * @default process.env.HYDRA_SERVICE_URL || 'https://api.ciscospark.com/v1'
   */
  hydraServiceUrl: process.env.HYDRA_SERVICE_URL || 'https://api.ciscospark.com/v1',
  /**
   * Credentials configuration (empty by default).
   * @type {object}
   * @public
   */
  credentials: {},
  /**
   * Device configuration options.
   * @type {object}
   * @public
   * @property {boolean} validateDomains - Whether to validate device domains.
   * @property {boolean} ephemeral - Whether the device is ephemeral.
   */
  device: {
    validateDomains: true,
    ephemeral: true,
  },
  /**
   * Storage configuration for the SDK.
   * @type {object}
   * @public
   * @property {typeof MemoryStoreAdapter} boundedAdapter - Adapter for bounded storage.
   * @property {typeof MemoryStoreAdapter} unboundedAdapter - Adapter for unbounded storage.
   */
  storage: {
    boundedAdapter: MemoryStoreAdapter,
    unboundedAdapter: MemoryStoreAdapter,
  },
};
