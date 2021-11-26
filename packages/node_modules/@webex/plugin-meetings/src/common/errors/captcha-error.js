import {ERROR_DICTIONARY} from '../../constants';

/**
 * Extended Error object to signify captcha related errors
 */
export default class CaptchaError extends Error {
  /**
  *
  * @constructor
  * @param {String} [message]
  * @param {Object} [error]
  */
  constructor(message = ERROR_DICTIONARY.CAPTCHA.MESSAGE, error = null) {
    super(message);
    this.name = ERROR_DICTIONARY.CAPTCHA.NAME;
    this.sdkMessage = ERROR_DICTIONARY.CAPTCHA.MESSAGE;
    this.error = error;
    this.stack = error ? error.stack : (new Error()).stack;
    this.code = ERROR_DICTIONARY.CAPTCHA.CODE;
  }
}
