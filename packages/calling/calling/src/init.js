/* eslint-disable valid-jsdoc */
import Webex from 'webex';

/**
 * @param webexConfig - Webex config.
 */
export const initializeWebex = (webexConfig) => {
  const webex = Webex.init(webexConfig);

  return webex;
};
