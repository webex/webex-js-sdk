import * as MEETINGCONSTANTS from '../../constants';

/**
 * Extended Error object for reclaim host role when user is host already
 */
export default class ReclaimHostIsHostAlreadyError extends Error {
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
    message: string = MEETINGCONSTANTS.ERROR_DICTIONARY.RECLAIM_HOST_ROLE_IS_ALREADY_HOST.MESSAGE,
    error: any = null
  ) {
    super(message);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ReclaimHostIsHostAlreadyError);
    }

    this.name = MEETINGCONSTANTS.ERROR_DICTIONARY.RECLAIM_HOST_ROLE_IS_ALREADY_HOST.NAME;
    this.sdkMessage =
      message || MEETINGCONSTANTS.ERROR_DICTIONARY.RECLAIM_HOST_ROLE_IS_ALREADY_HOST.MESSAGE;
    this.error = error;

    this.code = MEETINGCONSTANTS.ERROR_DICTIONARY.RECLAIM_HOST_ROLE_IS_ALREADY_HOST.CODE;
  }
}
