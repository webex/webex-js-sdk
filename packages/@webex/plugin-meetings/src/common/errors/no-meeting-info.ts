import {ERROR_DICTIONARY} from '../../constants';

/**
 * Extended Error object for general parameter errors
 */
export default class NoMeetingInfoError extends Error {
  code: any;
  error: any;
  sdkMessage: any;

  /**
   * @constructor
   * @param {String} [message]
   * @param {Object} [error]
   */
  constructor(message: string = ERROR_DICTIONARY.NO_MEETING_INFO.MESSAGE, error: any = null) {
    super(message);
    this.name = ERROR_DICTIONARY.NO_MEETING_INFO.NAME;
    this.sdkMessage = ERROR_DICTIONARY.NO_MEETING_INFO.MESSAGE;
    this.error = error;
    this.stack = error ? error.stack : new Error().stack;
    this.code = ERROR_DICTIONARY.NO_MEETING_INFO.CODE;
  }
}
