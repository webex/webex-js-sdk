// The document would auto generate the doc for errors

// 1) Error codes for Oauth, login, mercury should be separated out (Code range)
// 2) Errors from the actual locus server or other server in case, we can use the same error code as locus and redirect it
// 3) Any errors we generate from the SDK can be split into various categories
// Parameter validation, user action, connection, media specific(They can have different range)

// TODO: all the errors from the server need to be captured

// add a way to log and send metrics if needed
import WebexMeetingsError from './webex-meetings-error';

const WebExMeetingsErrors = {};

/**
 * Create a {@link WebexMeetingsError} for a given code and message.
 * @private
 * @param {number} [code] - Error code
 * @param {string} [message] - Error message
 * @returns {WebexMeetingsError}
 */
export function createMeetingsError(code?: number, message?: string) {
  code = typeof code === 'number' ? code : 0;
  message = typeof message === 'string' && message ? message : 'Unknown error';

  return WebExMeetingsErrors[code]
    ? new WebExMeetingsErrors[code]()
    : new WebexMeetingsError(code, message);
}

/**
 * @class MeetingNotActiveError
 * @classdesc Raised whenever Meeting has already ended and user tries to do a action.
 * @extends WebexMeetingsError
 * @property {number} code - 30101
 * @property {string} message - 'Meeting has already Ended or not Active'
 */
class MeetingNotActiveError extends WebexMeetingsError {
  static CODE = 30101;

  constructor() {
    super(MeetingNotActiveError.CODE, 'Meeting has already Ended or not Active');
  }
}

export {MeetingNotActiveError};
WebExMeetingsErrors[MeetingNotActiveError.CODE] = MeetingNotActiveError;

/**
 * @class UserNotJoinedError
 * @classdesc Raised whenever the user has already left the meeting and user tries to do a action.
 * @extends WebexMeetingsError
 * @property {number} code - 30102
 * @property {string} message - 'User has already left the meeting'
 */
class UserNotJoinedError extends WebexMeetingsError {
  static CODE = 30102;

  constructor() {
    super(
      UserNotJoinedError.CODE,
      'User currently not in meeting. Please join a meeting before adding media.'
    );
  }
}

export {UserNotJoinedError};
WebExMeetingsErrors[UserNotJoinedError.CODE] = UserNotJoinedError;

/**
 * @class NoMediaEstablishedYetError
 * @classdesc Raised whenever the user has not established media yet.
 * @extends WebexMeetingsError
 * @property {number} code - 30103
 * @property {string} message - 'User has not established media yet'
 */
class NoMediaEstablishedYetError extends WebexMeetingsError {
  static CODE = 30103;

  constructor() {
    super(NoMediaEstablishedYetError.CODE, 'User has not established media yet');
  }
}

export {NoMediaEstablishedYetError};
WebExMeetingsErrors[NoMediaEstablishedYetError.CODE] = NoMediaEstablishedYetError;

/**
 * @class UserInLobbyError
 * @classdesc Raised whenever the user is in lobby and not joined yet.
 * @extends WebexMeetingsError
 * @property {number} code - 30104
 * @property {string} message - 'user is still in the lobby or not joined'
 */
class UserInLobbyError extends WebexMeetingsError {
  static CODE = 30104;

  constructor() {
    super(UserInLobbyError.CODE, 'user is still in the lobby or not joined');
  }
}

export {UserInLobbyError};
WebExMeetingsErrors[UserInLobbyError.CODE] = UserInLobbyError;

/**
 * @class InvalidSdpError
 * @classdesc Raised whenever SDP generated via browser is invalid.
 * @extends WebexMeetingsError
 * @property {number} code - 30201
 * @property {string} message - 'user is still in the lobby or not joined'
 */
class InvalidSdpError extends WebexMeetingsError {
  static CODE = 30201;

  constructor(message) {
    super(InvalidSdpError.CODE, message || 'iceConnection: sdp generated is invalid');
  }
}

export {InvalidSdpError};
WebExMeetingsErrors[InvalidSdpError.CODE] = InvalidSdpError;

/**
 * @class IceGatheringFailed
 * @classdesc Raised whenever ice gathering fails.
 * @extends WebexMeetingsError
 * @property {number} code - 30202
 * @property {string} message - 'user failed ice gathering check network/firewall'
 */
class IceGatheringFailed extends WebexMeetingsError {
  static CODE = 30202;

  constructor() {
    super(IceGatheringFailed.CODE, 'iceConnection: gethering ice candidate failed');
  }
}

export {IceGatheringFailed};
WebExMeetingsErrors[IceGatheringFailed.CODE] = IceGatheringFailed;
