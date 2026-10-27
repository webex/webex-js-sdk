/**
 * Returns the base URL for a plugin's assets in the Webex UMD or npm package.
 *
 * @param {string} pluginName Directory name under `umd/assets/`.
 * @param {string} sdkVersion Version of the `webex` package containing the assets.
 * @param {string} pluginVersion Version of the individual plugin npm package.
 * @returns {string} Local development path or versioned package asset URL.
 */
export const getUmdAssetsBaseUrl = (pluginName, sdkVersion, pluginVersion) => {
  if (process.env.NODE_ENV === 'development') {
    return `/assets/${pluginName}/`;
  }

  if (isVersionAvailable(sdkVersion)) {
    return `https://unpkg.com/webex@${sdkVersion}/umd/assets/${pluginName}/`;
  }

  if (isVersionAvailable(pluginVersion)) {
    return `https://unpkg.com/@webex/${pluginName}@${pluginVersion}/dist/assets/`;
  }

  return `/assets/${pluginName}/`;
};

const isVersionAvailable = (version) => version && version !== 'undefined' && version !== '0.0.0';
