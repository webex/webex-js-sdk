/*!
 * Copyright (c) 2026 Cisco Systems, Inc. See LICENSE file.
 */

import {StaticAssetLoader} from '@webex/webex-core';

/**
 * Downloads a static asset from `assetsBaseUrl`. A new loader is used for
 * every call so a response that later fails verification is never served
 * from the loader's cache; callers cache the verified result instead.
 * @param {Object} options
 * @param {Object} options.webex
 * @param {?string} options.assetsBaseUrl
 * @param {string} options.assetName
 * @returns {Promise<Uint8Array>}
 */
export default function loadFromUrl({webex, assetsBaseUrl, assetName}) {
  if (!assetsBaseUrl) {
    return Promise.reject(new Error('`encryption.assetsBaseUrl` is not configured'));
  }

  return new StaticAssetLoader({baseUrl: assetsBaseUrl}, {parent: webex}).getBytes(assetName);
}
