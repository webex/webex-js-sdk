import {ERROR_DICTIONARY} from '../../constants';

/**
 * Error occurred while join the webinar
 */
export default class JoinWebinarError extends Error {
  code: number;
  error: any;
  sdkMessage: string;

  /**
   * @constructor
   * @param {String} [message]
   * @param {Object} [error]
   */
  constructor(message: string = ERROR_DICTIONARY.JoinWebinarError.MESSAGE, error: any = null) {
    super(message);
    this.name = ERROR_DICTIONARY.JoinWebinarError.NAME;
    this.sdkMessage = ERROR_DICTIONARY.JoinWebinarError.MESSAGE;
    this.error = error;
    this.stack = error ? error.stack : new Error().stack;
    this.code = ERROR_DICTIONARY.JoinWebinarError.CODE;
  }
}
