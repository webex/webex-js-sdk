/* eslint-disable @typescript-eslint/no-var-requires */

import bowser from 'bowser';
import {memoize} from 'lodash';
import window from 'global/window';

const createDetectionObject = (results) => {
  const getOSName = () => results?.getOSName() ?? '';
  const getOSVersion = () => results?.getOSVersion() ?? '';

  const getBrowserName = () => results?.getBrowserName() ?? '';
  const getBrowserVersion = () => results?.getBrowserVersion() ?? '';

  const isBrowser = (name) => !!results?.isBrowser(name, true);

  return {
    getOSName,
    getOSVersion,
    getBrowserName,
    getBrowserVersion,
    isBrowser,
  };
};

export default memoize((agent?: any) => {
  if (agent !== null && agent !== undefined) {
    return createDetectionObject(bowser.getParser(agent));
  }

  return createDetectionObject(bowser.getParser(window.navigator.userAgent));
});
