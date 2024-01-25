import {ERROR_DICTIONARY} from '../../constants';

/**
 * Extended Error object to signify the intent to join for unclaimed PMR scenarios
 */
export class ReconnectionError extends Error {
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

/**
 * Error intended to be thrown when a new instance of ReconnectionManager is required due to previous clean up
 */
export class ReconnectionManagerNotDefined extends ReconnectionError {}
