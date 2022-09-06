import {ERROR_DICTIONARY} from '../../constants';

/**
 * Extended Error object for general parameter errors
 */
export default class PermissionError extends Error {
  /**
  * @constructor
  * @param {String} [message]
  * @param {Object} [error]
  */
  constructor(message = ERROR_DICTIONARY.PERMISSION.MESSAGE, error = null) {
    super(message);
    this.name = ERROR_DICTIONARY.PERMISSION.NAME;
    this.sdkMessage = ERROR_DICTIONARY.PERMISSION.MESSAGE;
    this.error = error;
    this.stack = error ? error.stack : (new Error()).stack;
    this.code = ERROR_DICTIONARY.PERMISSION.CODE;
  }
}
