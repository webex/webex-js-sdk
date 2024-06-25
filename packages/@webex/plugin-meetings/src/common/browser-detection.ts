/* eslint-disable @typescript-eslint/no-var-requires */

import bowser from 'bowser';
import {memoize} from 'lodash';
import window from 'global/window';

const mockDetectionObject = {
  /* eslint-disable global-require */
  getOSName: () => require('os').platform(),
  getOSVersion: () => require('os').release(),
  /* eslint-enable global-require */
  getBrowserName: () => '',
  getBrowserVersion: () => '',
  isBrowser: () => false,
};

const createDetectionObject = (results: Record<string, any>) => {
  const getOSName = () => results?.getOSName() ?? '';
  const getOSVersion = () => results?.getOSVersion() ?? '';

  const getBrowserName = () => results?.getBrowserName() ?? '';
  const getBrowserVersion = () => results?.getBrowserVersion() ?? '';

  const isBrowser = (name: unknown) => !!results?.isBrowser(name, true);

  return {
    getOSName,
    getOSVersion,
    getBrowserName,
    getBrowserVersion,
    isBrowser,
  };
};

export default memoize((agent?: string) =>
  agent || window.navigator?.userAgent
    ? createDetectionObject(bowser.getParser(agent || window.navigator.userAgent))
    : mockDetectionObject
);
