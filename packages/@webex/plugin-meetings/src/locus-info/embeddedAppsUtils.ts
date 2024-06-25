import {EMBEDDED_APP_TYPES} from '../constants';

const EmbeddedAppsUtils: any = {};
const SLIDO_REGEX = /.sli.do\//;

/**
 * Parse the relevant values that we care about
 * @param {Record<string, any>} embeddedApp - raw embedded app object
 * @returns {Record<string, any>} parsedObject - parsed embedded app object
 */
EmbeddedAppsUtils.parseApp = (embeddedApp: Record<string, any>) => {
  const parsedApp: Record<string, any> = {...embeddedApp};

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
 * @param {Record<string, any>[]} apps1 - an array of apps
 * @param {Record<string, any>[]} apps2 - an array of apps
 * @returns {boolean} true if the arrays are different
 */
EmbeddedAppsUtils.areSimilar = (apps1: Record<string, any>[], apps2: Record<string, any>[]) => {
  if (!apps1 || !apps2) {
    return apps1 === apps2;
  }

  if (apps1?.length !== apps2?.length) {
    return false;
  }

  for (let i = 0; i < apps1.length; i += 1) {
    if (apps1[i].state !== apps2[i].state) {
      return false;
    }
  }

  return true;
};

/**
 * Parse the array of embedded apps
 * @param {Record<string, any>[]} embeddedApps
 * @returns {Record<string, any>[]} result - new array of parsed embedded app objects
 */
EmbeddedAppsUtils.parse = (embeddedApps: Record<string, any>[]): Record<string, any>[] =>
  embeddedApps && embeddedApps.map(EmbeddedAppsUtils.parseApp);

export default EmbeddedAppsUtils;
