import {ERROR_DICTIONARY} from '../../constants';

/**
 * Extended Error object for media errors
 */
export default class MediaError extends Error {
  /**
  *
  * @constructor
  * @param {String} [message]
  * @param {Object} [error]
  */
  constructor(message = ERROR_DICTIONARY.MEDIA.MESSAGE, error = null) {
    super(message);
    this.name = ERROR_DICTIONARY.RECONNECTION.NAME;
    this.sdkMessage = ERROR_DICTIONARY.MEDIA.MESSAGE;
    this.error = error;
    this.stack = error ? error.stack : (new Error()).stack;
    this.code = ERROR_DICTIONARY.RECONNECTION.CODE;
  }
}
