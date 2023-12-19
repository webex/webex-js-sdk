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
 * @property {string} message - error message
 */
class NoMediaEstablishedYetError extends WebexMeetingsError {
  static CODE = 30103;

  // eslint-disable-next-line require-jsdoc
  constructor() {
    super(
      NoMediaEstablishedYetError.CODE,
      'Webrtc media connection is missing, call addMedia() first'
    );
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
 * @class SpaceIDDeprecatedError
 * @classdesc Raised whenever the user passes Space ID as destination for create meeting.
 * @extends WebexMeetingsError
 * @property {number} code - 30105
 * @property {string} message - Using the space ID as a destination is no longer supported. Please refer to the [migration guide](https://github.com/webex/webex-js-sdk/wiki/Migration-to-Unified-Space-Meetings) to migrate to use the meeting ID or SIP address.'
 */
class SpaceIDDeprecatedError extends WebexMeetingsError {
  static CODE = 30105;

  constructor() {
    super(
      SpaceIDDeprecatedError.CODE,
      'Using the space ID as a destination is no longer supported. Please refer to the [migration guide](https://github.com/webex/webex-js-sdk/wiki/Migration-to-Unified-Space-Meetings) to migrate to use the meeting ID or SIP address.'
    );
  }
}

export {SpaceIDDeprecatedError};
WebExMeetingsErrors[SpaceIDDeprecatedError.CODE] = SpaceIDDeprecatedError;

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

/**
 * @class AddMediaFailed
 * @classdesc Raised whenever we fail to successfully add media to a meeting
 * @extends WebexMeetingsError
 * @property {number} code - 30203
 * @property {string} message - 'Failed to add media'
 */
class AddMediaFailed extends WebexMeetingsError {
  static CODE = 30203;

  constructor() {
    super(AddMediaFailed.CODE, 'Failed to add media');
  }
}
export {AddMediaFailed};
WebExMeetingsErrors[AddMediaFailed.CODE] = AddMediaFailed;
