import anonymize from 'ip-anonymize';
import util from 'util';

import BrowserDetection from '@webex/common/src/browser-detection';
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

export const clearEmpty = (obj) => {
  // Check if the object is empty
  if (Object.keys(obj).length === 0) {
    return;
  }

  Object.keys(obj).forEach((key) => {
    if ((typeof obj[key] === 'object' || Array.isArray(obj[key])) && isEmpty(obj[key])) {
      delete obj[key];
    }
    if (Array.isArray(obj[key])) {
      Object.assign(obj, {[key]: obj[key].filter((x) => !!x)});
    }
    if (typeof obj[key] === 'object') {
      clearEmpty(obj[key]);
    }
  });
};
