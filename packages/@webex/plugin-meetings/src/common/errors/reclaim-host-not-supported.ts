import * as MEETINGCONSTANTS from '../../constants';

/**
 * Extended Error object for reclaim host role not supported
 */
export default class ReclaimHostNotSupportedError extends Error {
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
    message: string = MEETINGCONSTANTS.ERROR_DICTIONARY.RECLAIM_HOST_NOT_SUPPORTED.MESSAGE,
    error: any = null
  ) {
    super(message);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ReclaimHostNotSupportedError);
    }

    this.name = MEETINGCONSTANTS.ERROR_DICTIONARY.RECLAIM_HOST_NOT_SUPPORTED.NAME;
    this.sdkMessage =
      message || MEETINGCONSTANTS.ERROR_DICTIONARY.RECLAIM_HOST_NOT_SUPPORTED.MESSAGE;
    this.error = error;

    this.code = MEETINGCONSTANTS.ERROR_DICTIONARY.RECLAIM_HOST_NOT_SUPPORTED.CODE;
  }
}
