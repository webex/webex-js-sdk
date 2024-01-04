import * as MEETINGCONSTANTS from '../../constants';

/**
 * Extended Error object for reclaim host role empty or wrong key
 */
export default class ReclaimHostEmptyWrongKeyError extends Error {
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
    message: string = MEETINGCONSTANTS.ERROR_DICTIONARY.RECLAIM_HOST_ROLE_EMPTY_OR_WRONG_KEY
      .MESSAGE,
    error: any = null
  ) {
    super(message);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ReclaimHostEmptyWrongKeyError);
    }

    this.name = MEETINGCONSTANTS.ERROR_DICTIONARY.RECLAIM_HOST_ROLE_EMPTY_OR_WRONG_KEY.NAME;
    this.sdkMessage =
      message || MEETINGCONSTANTS.ERROR_DICTIONARY.RECLAIM_HOST_ROLE_EMPTY_OR_WRONG_KEY.MESSAGE;
    this.error = error;

    this.code = MEETINGCONSTANTS.ERROR_DICTIONARY.RECLAIM_HOST_ROLE_EMPTY_OR_WRONG_KEY.CODE;
  }
}
