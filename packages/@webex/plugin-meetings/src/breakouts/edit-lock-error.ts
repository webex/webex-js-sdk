import {ERROR_DICTIONARY} from '../constants';

/**
 * Extended Error object to signify breakout related errors
 */
export default class BreakoutEditLockedError extends Error {
  code: any;
  error: any;
  sdkMessage: any;

  /**
   *
   * @constructor
   * @param {String} [message]
   * @param {Object} [error]
   */
  constructor(message: string = ERROR_DICTIONARY.BREAKOUT_EDIT.MESSAGE, error: any = null) {
    super(message);
    this.name = ERROR_DICTIONARY.BREAKOUT_EDIT.NAME;
    this.sdkMessage = ERROR_DICTIONARY.BREAKOUT_EDIT.MESSAGE;
    this.error = error;
    this.stack = error ? error.stack : new Error().stack;
    this.code = ERROR_DICTIONARY.BREAKOUT_EDIT.CODE;
  }
}
