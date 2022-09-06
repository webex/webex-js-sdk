import {EMBEDDED_APP_TYPES} from '../constants';

const EmbeddedAppsUtils = {};

const SLIDO_REGEX = /.sli.do\//;

/**
 * Parse the relevant values that we care about
 * @param {Object} embeddedApp - raw embedded app object
 * @returns {Object} parsedObject - parsed embedded app object
 */
EmbeddedAppsUtils.parseApp = (embeddedApp) => {
  const parsedApp = {...embeddedApp};

  parsedApp.type = EMBEDDED_APP_TYPES.OTHER;
  const url = parsedApp.instanceInfo?.appInstanceUrl;

  if (url && url.match(SLIDO_REGEX)) {
    parsedApp.type = EMBEDDED_APP_TYPES.SLIDO;
  }

  return parsedApp;
};

/**
 * Determines if two embedded apps arrays are similar.
 * NOTE: This is a simple test for performance reasons.
 * @param {any[]} apps1 - an array of apps
 * @param {any[]} apps2 - an array of apps
 * @returns {boolean} true if the arrays are different
 */
EmbeddedAppsUtils.areSimilar = (apps1, apps2) => {
  if (apps1?.length !== apps2?.length) {
    return false;
  }
  if (apps1?.[0]?.state !== apps2?.[0]?.state) {
    return false;
  }

  return true;
};

/**
 * Parse the array of embedded apps
 * @param {array} embeddedApps
 * @returns {array} result - new array of parsed embedded app objects
 */
EmbeddedAppsUtils.parse = (embeddedApps) => embeddedApps && embeddedApps.map(EmbeddedAppsUtils.parseApp);


export default EmbeddedAppsUtils;
