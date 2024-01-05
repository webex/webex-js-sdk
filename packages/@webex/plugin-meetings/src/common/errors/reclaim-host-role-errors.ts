import * as MEETINGCONSTANTS from '../../constants';

/**
 * Extended Error object for reclaim host role empty or wrong key
 */
export class ReclaimHostEmptyWrongKeyError extends Error {
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

/**
 * Extended Error object for reclaim host role not supported
 */
export class ReclaimHostNotSupportedError extends Error {
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
    message: string = MEETINGCONSTANTS.ERROR_DICTIONARY.RECLAIM_HOST_ROLE_NOT_SUPPORTED.MESSAGE,
    error: any = null
  ) {
    super(message);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ReclaimHostNotSupportedError);
    }

    this.name = MEETINGCONSTANTS.ERROR_DICTIONARY.RECLAIM_HOST_ROLE_NOT_SUPPORTED.NAME;
    this.sdkMessage =
      message || MEETINGCONSTANTS.ERROR_DICTIONARY.RECLAIM_HOST_ROLE_NOT_SUPPORTED.MESSAGE;
    this.error = error;

    this.code = MEETINGCONSTANTS.ERROR_DICTIONARY.RECLAIM_HOST_ROLE_NOT_SUPPORTED.CODE;
  }
}

/**
 * Extended Error object for reclaim host role not allowed for other participants
 */
export class ReclaimHostNotAllowedError extends Error {
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

/**
 * Extended Error object for reclaim host role when user is host already
 */
export class ReclaimHostIsHostAlreadyError extends Error {
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
