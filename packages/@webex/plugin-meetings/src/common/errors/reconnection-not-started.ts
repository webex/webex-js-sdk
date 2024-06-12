import {ERROR_DICTIONARY} from '../../constants';
import ReconnectionError from './reconnection';

/**
 * Error object for cases when new reconnection cannot be started
 */
export default class ReconnectionNotStartedError extends ReconnectionError {
  /**
   *
   * @constructor
   * @param {String} [message]
   * @param {Object} [error]
   */
  constructor(
    message: string = ERROR_DICTIONARY.RECONNECTION_NOT_STARTED.MESSAGE,
    error: any = null
  ) {
    super(message, error);
    this.name = ERROR_DICTIONARY.RECONNECTION_NOT_STARTED.NAME;
    this.sdkMessage = ERROR_DICTIONARY.RECONNECTION_NOT_STARTED.MESSAGE;
    this.error = error;
    this.stack = error ? error.stack : new Error().stack;
    this.code = ERROR_DICTIONARY.RECONNECTION_NOT_STARTED.CODE;
  }
}
