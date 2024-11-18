import {ERROR_DICTIONARY} from '../../constants';

/**
 * Extended Error object for join flow call meetinginfo api error
 */
export default class JoinStatusError extends Error {
  code: any;
  error: any;
  sdkMessage: any;

  /**
   * @constructor
   * @param {String} [message]
   * @param {Object} [error]
   */
  constructor(message: string = ERROR_DICTIONARY.JoinStatusError.MESSAGE, error: any = null) {
    super(message);
    this.name = ERROR_DICTIONARY.JoinStatusError.NAME;
    this.sdkMessage = ERROR_DICTIONARY.JoinStatusError.MESSAGE;
    this.error = error;
    this.stack = error ? error.stack : new Error().stack;
    this.code = ERROR_DICTIONARY.JoinStatusError.CODE;
  }
}
