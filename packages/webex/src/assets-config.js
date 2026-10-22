/*!
 * Copyright (c) 2026 Cisco Systems, Inc. See LICENSE file.
 */

// CommonJS on purpose: the entry points merge this object directly, so it must
// not be wrapped in an ES module namespace (`{default: ...}`).

/**
 * Base URL of a plugin's static assets. Published builds load them from the
 * matching `webex` release on jsDelivr (`umd/assets/<plugin-name>/`); local,
 * unversioned builds (e.g. the samples dev server) serve them from
 * `/assets/<plugin-name>/` on the page's origin.
 * @param {string} pluginName
 * @returns {string}
 */
const getAssetsBaseUrl = (pluginName) =>
  /^\d+\.\d+\.\d+/.test(PACKAGE_VERSION) && PACKAGE_VERSION !== '0.0.0'
    ? `https://cdn.jsdelivr.net/npm/webex@${PACKAGE_VERSION}/umd/assets/${pluginName}/`
    : `/assets/${pluginName}/`;

module.exports = {
  encryption: {
    assetsBaseUrl: getAssetsBaseUrl('internal-plugin-encryption'),
  },
};
