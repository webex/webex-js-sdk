/**
 * Returns the base URL for a plugin's assets in the Webex UMD package.
 *
 * @param {string} pluginName Directory name under `umd/assets/`.
 * @param {string} sdkVersion Version of the `webex` package containing the assets.
 * @returns {string} Local development path or versioned UMD asset URL.
 */
export const getUmdAssetsBaseUrl = (pluginName, sdkVersion) => {
  if (
    process.env.NODE_ENV === 'development' ||
    !sdkVersion ||
    sdkVersion === 'undefined' ||
    sdkVersion === '0.0.0'
  ) {
    return `/assets/${pluginName}/`;
  }

  return `https://unpkg.com/webex@${sdkVersion}/umd/assets/${pluginName}/`;
};
