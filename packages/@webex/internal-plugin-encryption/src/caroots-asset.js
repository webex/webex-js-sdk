/*!
 * Copyright (c) 2026 Cisco Systems, Inc. See LICENSE file.
 */

import fs from 'fs';
import path from 'path';

import loadFromUrl from './caroots-asset-url';

/**
 * Loads a static asset in Node. Reads the copy shipped with the package
 * (`dist/assets/` when built, `assets/` from source) so no network is needed,
 * falling back to `assetsBaseUrl` when the file isn't present.
 * @param {Object} options
 * @param {Object} options.webex
 * @param {?string} options.assetsBaseUrl
 * @param {string} options.assetName
 * @returns {Promise<Uint8Array>}
 */
export default function loadCarootsAsset({webex, assetsBaseUrl, assetName}) {
  const candidates = [
    path.join(__dirname, 'assets', assetName),
    path.join(__dirname, '..', 'assets', assetName),
  ];
  const assetPath = candidates.find((candidate) => fs.existsSync(candidate));

  if (assetPath) {
    return fs.promises.readFile(assetPath).then((buffer) => new Uint8Array(buffer));
  }

  return loadFromUrl({webex, assetsBaseUrl, assetName});
}
