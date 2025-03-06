import {ERROR_DICTIONARY} from '../../constants';

/**
 * Error occurred while join the meeting
 */
export default class JoinForbiddenError extends Error {
  code: number;
  error: any;
  sdkMessage: string;
  wbxAppApiCode: number;

  /**
   * @constructor
   * @param {String} [message]
   * @param {Object} [error]
   */
  constructor(message: string = ERROR_DICTIONARY.JoinForbiddenError.MESSAGE, error: any = null) {
    super(message);
    this.name = ERROR_DICTIONARY.JoinForbiddenError.NAME;
    this.sdkMessage = message;
    this.error = error;
    this.stack = error ? error.stack : new Error().stack;
    this.code = ERROR_DICTIONARY.JoinForbiddenError.CODE;
    this.wbxAppApiCode = error?.wbxAppApiCode;
  }
}
