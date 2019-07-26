import {ERROR_DICTIONARY} from '../../constants';

/**
 * Extended Error object to signify a join meeting error
 */
export default class JoinMeetingError extends Error {
  /**
  *
  * @constructor
  * @param {Object} [options]
  * @param {String} [message]
  * @param {Object} [error]
  */
  constructor(options = {}, message = ERROR_DICTIONARY.JOIN_MEETING.MESSAGE, error = null) {
    super(message);
    this.name = ERROR_DICTIONARY.JOIN_MEETING.NAME;
    this.sdkMessage = ERROR_DICTIONARY.JOIN_MEETING.MESSAGE;
    this.error = error;
    this.stack = error ? error.stack : (new Error()).stack;
    this.joinOptions = options;
    this.code = ERROR_DICTIONARY.JOIN_MEETING.CODE;
  }
}
