/* eslint-disable valid-jsdoc */
import {WebexSDK} from './types';

// TODO: add other cases necessary for fully qualified webex instance
// eslint-disable-next-line max-len
/**
 * @param webexInstance - TODO.
 */
export const validateWebex = (
  webexInstance: WebexSDK
): {error: Error | undefined; success: boolean} => {
  if (webexInstance.canAuthorize) {
    if (webexInstance.ready) {
      if (webexInstance.internal.mercury) {
        return {error: undefined, success: true};
      }

      return {error: new Error('webex.internal.mercury is not available'), success: false};
    }

    return {error: new Error('webex.ready is not true'), success: false};
  }

  return {error: new Error('webex.canAuthorize is not true'), success: false}; // TODO: change to error object
};
