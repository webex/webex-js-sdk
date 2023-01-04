import {ERROR_DICTIONARY} from '../../constants';

/**
 * Extended Error object to signify password related errors
 */
export default class PasswordError extends Error {
  code: any;
  error: any;
  sdkMessage: any;

  /**
   *
   * @constructor
   * @param {String} [message]
   * @param {Object} [error]
   */
  constructor(message: string = ERROR_DICTIONARY.PASSWORD.MESSAGE, error: any = null) {
    super(message);
    this.name = ERROR_DICTIONARY.PASSWORD.NAME;
    this.sdkMessage = ERROR_DICTIONARY.PASSWORD.MESSAGE;
    this.error = error;
    this.stack = error ? error.stack : new Error().stack;
    this.code = ERROR_DICTIONARY.PASSWORD.CODE;
  }
}
