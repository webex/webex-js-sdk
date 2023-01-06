import {ERROR_DICTIONARY} from '../../constants';

/**
 * Extended Error object to signify a join meeting error
 */
export default class JoinMeetingError extends Error {
  code: any;
  error: any;
  joinOptions: any;
  sdkMessage: any;

  /**
   *
   * @constructor
   * @param {Object} [options]
   * @param {String} [message]
   * @param {Object} [error]
   */
  constructor(
    options: object = {},
    message: string = ERROR_DICTIONARY.JOIN_MEETING.MESSAGE,
    error: any = null
  ) {
    super(message);
    this.name = ERROR_DICTIONARY.JOIN_MEETING.NAME;
    this.sdkMessage = ERROR_DICTIONARY.JOIN_MEETING.MESSAGE;
    this.error = error;
    this.stack = error ? error.stack : new Error().stack;
    this.joinOptions = options;
    this.code = ERROR_DICTIONARY.JOIN_MEETING.CODE;
  }
}
