/* eslint-disable valid-jsdoc */
import anonymize from 'ip-anonymize';
import util from 'util';

import {BrowserDetection} from '@webex/common';
import {isEmpty} from 'lodash';

const {getOSName, getOSVersion, getBrowserName, getBrowserVersion} = BrowserDetection();

export const anonymizeIPAddress = (localIp) => anonymize(localIp, 28, 96);

/**
 * Returns a formated string of the user agent.
 *
 * @returns {string} formatted user agent information
 */
export const userAgentToString = ({clientName, webexVersion}) => {
  let userAgentOption;
  let browserInfo;
  const clientInfo = util.format('client=%s', `${clientName}`);

  if (
    ['chrome', 'firefox', 'msie', 'msedge', 'safari'].indexOf(getBrowserName().toLowerCase()) !== -1
  ) {
    browserInfo = util.format(
      'browser=%s',
      `${getBrowserName().toLowerCase()}/${getBrowserVersion().split('.')[0]}`
    );
  }
  const osInfo = util.format('os=%s', `${getOSName()}/${getOSVersion().split('.')[0]}`);

  if (browserInfo) {
    userAgentOption = `(${browserInfo}`;
  }
  if (osInfo) {
    userAgentOption = userAgentOption
      ? `${userAgentOption}; ${clientInfo}; ${osInfo}`
      : `${clientInfo}; (${osInfo}`;
  }
  if (userAgentOption) {
    userAgentOption += ')';

    return util.format(
      'webex-js-sdk/%s %s',
      `${process.env.NODE_ENV}-${webexVersion}`,
      userAgentOption
    );
  }

  return util.format('webex-js-sdk/%s', `${process.env.NODE_ENV}-${webexVersion}`);
};

/**
 * Iterates object recursively and removes any
 * property that returns isEmpty for it's associated value
 * isEmpty = implementation from Lodash.
 *
 * It modifies the object in place (mutable)
 *
 * @param obj - input
 * @returns
 */
export const clearEmptyKeysRecursively = (obj: any) => {
  // Check if the object is empty
  if (Object.keys(obj).length === 0) {
    return;
  }

  Object.keys(obj).forEach((key) => {
    if (
      (typeof obj[key] === 'object' || typeof obj[key] === 'string' || Array.isArray(obj[key])) &&
      isEmpty(obj[key])
    ) {
      delete obj[key];
    }
    if (Array.isArray(obj[key])) {
      obj[key] = [...obj[key].filter((x) => !!x)];
    }
    if (typeof obj[key] === 'object') {
      clearEmptyKeysRecursively(obj[key]);
    }
  });
};

/**
 * Locus error codes start with 2. The next three digits are the
 * HTTP status code related to the error code (like 400, 403, 502, etc.)
 * The remaining three digits are just an increasing integer.
 * If it is 7 digits and starts with a 2, it is locus.
 *
 * @param errorCode
 * @returns
 */
export const isLocusServiceErrorCode = (errorCode: string | number) => {
  const code = `${errorCode}`;

  if (code.length === 7 && code.charAt(0) === '2') {
    return true;
  }

  return false;
};
