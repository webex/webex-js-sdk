/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/**
 * Catalog details enumeration
 * @enum {string}
 */
export const CatalogDetails = {
  all: 'all',
  features: 'features',
  websocket: 'websocket',
  none: 'none',
};

/**
 * Device registration options type definition
 * @typedef {Object} DeviceRegistrationOptions
 * @property {CatalogDetails} [includeDetails] - Details to include in catalog
 */

// Export as class for better compatibility
export class DeviceRegistrationOptions {
  /**
   * @param {Object} options
   * @param {CatalogDetails} [options.includeDetails]
   */
  constructor(options = {}) {
    this.includeDetails = options.includeDetails;
  }
}
