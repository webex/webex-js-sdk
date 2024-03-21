import * as MEETINGCONSTANTS from '../../constants';

/**
 * Extended Error object for general parameter errors
 */
export default class ParameterError extends Error {
  sdkMessage: string;
  error: null;
  code: number;

  /**
   *
   * @constructor
   * @param {String} [message]
   * @param {Object} [error]
   */
  constructor(
    message: string = MEETINGCONSTANTS.ERROR_DICTIONARY.PARAMETER.MESSAGE,
    error: any = null
  ) {
    super(message);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ParameterError);
    }

    this.name = MEETINGCONSTANTS.ERROR_DICTIONARY.PARAMETER.NAME;
    this.sdkMessage = message || MEETINGCONSTANTS.ERROR_DICTIONARY.PARAMETER.MESSAGE;
    this.error = error;

    this.code = MEETINGCONSTANTS.ERROR_DICTIONARY.PARAMETER.CODE;
  }
}
