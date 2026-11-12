/*!
 * Copyright (c) 2026 Cisco Systems, Inc. See LICENSE file.
 */

import loadFromUrl from './caroots-asset-url';

/**
 * Loads a static asset in the browser from `assetsBaseUrl`.
 * @param {Object} options
 * @param {Object} options.webex
 * @param {?string} options.assetsBaseUrl
 * @param {string} options.assetName
 * @returns {Promise<Uint8Array>}
 */
export default function loadCarootsAsset(options) {
  return loadFromUrl(options);
}
