import {ERROR_DICTIONARY} from '../../constants';

/**
 * Error occurred while the webinar required registration
 */
export default class WebinarRegistrationError extends Error {
  code: number;
  error: any;
  sdkMessage: string;

  /**
   * @constructor
   * @param {String} [message]
   * @param {Object} [error]
   */
  constructor(
    message: string = ERROR_DICTIONARY.WebinarRegistrationError.MESSAGE,
    error: any = null
  ) {
    super(message);
    this.name = ERROR_DICTIONARY.WebinarRegistrationError.NAME;
    this.sdkMessage = ERROR_DICTIONARY.WebinarRegistrationError.MESSAGE;
    this.error = error;
    this.stack = error ? error.stack : new Error().stack;
    this.code = ERROR_DICTIONARY.WebinarRegistrationError.CODE;
  }
}
