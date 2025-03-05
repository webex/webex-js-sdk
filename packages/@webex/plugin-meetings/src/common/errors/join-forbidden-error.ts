import {ERROR_DICTIONARY} from '../../constants';

/**
 * Error occurred while join the meeting
 */
export default class JoinForbiddenError extends Error {
  code: number;
  error: any;
  sdkMessage: string;

  /**
   * @constructor
   * @param {String} [message]
   * @param {String} [code]
   * @param {Object} [error]
   */
  constructor(
    message: string = ERROR_DICTIONARY.JoinForbiddenError.MESSAGE,
    code = ERROR_DICTIONARY.JoinForbiddenError.CODE,
    error: any = null
  ) {
    super(message);
    this.name = ERROR_DICTIONARY.JoinForbiddenError.NAME;
    this.sdkMessage = message;
    this.error = error;
    this.stack = error ? error.stack : new Error().stack;
    this.code = code;
  }
}
