import * as MEETINGCONSTANTS from '../../constants';

/**
 * Extended Error object for reclaim host role not allowed for other participants
 */
export default class ReclaimHostNotAllowedError extends Error {
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
    message: string = MEETINGCONSTANTS.ERROR_DICTIONARY.RECLAIM_HOST_ROLE_NOT_ALLOWED.MESSAGE,
    error: any = null
  ) {
    super(message);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ReclaimHostNotAllowedError);
    }

    this.name = MEETINGCONSTANTS.ERROR_DICTIONARY.RECLAIM_HOST_ROLE_NOT_ALLOWED.NAME;
    this.sdkMessage =
      message || MEETINGCONSTANTS.ERROR_DICTIONARY.RECLAIM_HOST_ROLE_NOT_ALLOWED.MESSAGE;
    this.error = error;

    this.code = MEETINGCONSTANTS.ERROR_DICTIONARY.RECLAIM_HOST_ROLE_NOT_ALLOWED.CODE;
  }
}
