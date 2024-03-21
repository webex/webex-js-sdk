import {ERROR_DICTIONARY} from '../../constants';

/**
 * Extended Error object to signify the intent to join for unclaimed PMR scenarios
 */
export default class ReconnectionError extends Error {
  code: any;
  error: any;
  sdkMessage: any;

  /**
   *
   * @constructor
   * @param {String} [message]
   * @param {Object} [error]
   */
  constructor(message: string = ERROR_DICTIONARY.RECONNECTION.MESSAGE, error: any = null) {
    super(message);
    this.name = ERROR_DICTIONARY.RECONNECTION.NAME;
    this.sdkMessage = ERROR_DICTIONARY.RECONNECTION.MESSAGE;
    this.error = error;
    this.stack = error ? error.stack : new Error().stack;
    this.code = ERROR_DICTIONARY.RECONNECTION.CODE;
  }
}
