import bowser from 'bowser';
import window from 'global/window';
import {browserDetection} from './constants';

export const getBrowserSerial = () => {
  let browserData;
  try {
    browserData = window?.navigator?.userAgent
      ? bowser.getParser(window.navigator.userAgent)
      : {error: browserDetection.unableToAccessUserAgent};
  } catch (err) {
    browserData = {error: err.message};
  }

  return browserData;
};

const mockDetectionObject = {
  /* eslint-disable global-require */
  getOSName: () => require('os').platform(),
  getOSVersion: () => require('os').release(),
  /* eslint-enable global-require */
  getBrowserName: () => '',
  getBrowserVersion: () => '',
  isBrowser: () => false,
};

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

let browserDetectionData;

const checkBrowserDetection = (agent) => {
  if (browserDetectionData) {
    return browserDetectionData;
  }

  if (!agent || !window.navigator?.userAgent) {
    return mockDetectionObject;
  }

  const browserData = createDetectionObject(bowser.getParser(agent || window.navigator.userAgent));

  if (!browserData?.getBrowserName()) {
    return mockDetectionObject;
  }

  browserDetectionData = browserData;

  return browserDetectionData;
};

export default checkBrowserDetection;
