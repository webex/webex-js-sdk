
import LoggerProxy from '../common/logs/logger-proxy';
import ParameterError from '../common/errors/parameter';
import PermissionError from '../common/errors/permission';
import Media from '../media';
import MeetingUtil from '../meeting/util';
import {AUDIO, VIDEO} from '../constants';


/* Certain aspects of server interaction for video muting are not implemented as we currently don't support remote muting of video.
   If we ever need to support it, search for REMOTE_MUTE_VIDEO_MISSING_IMPLEMENTATION string to find the places that need updating
*/

const createMuteState = (type, meeting, mediaDirection) => {
  if (type === AUDIO && !mediaDirection.sendAudio) {
    return null;
  }
  if (type === VIDEO && !mediaDirection.sendVideo) {
    return null;
  }

  LoggerProxy.logger.info(`Meeting:muteState#createMuteState --> ${type}: creating MuteState for meeting id ${meeting?.id}`);

  return new MuteState(type, meeting);
};

/** The purpose of this class is to manage the local and remote mute state and make sure that the server state always matches
   the last requested state by the client.

   More info about Locus muting API: https://sqbu-github.cisco.com/pages/WebExSquared/locus/guides/mute.html#
*/
class MuteState {
  /**
   * Constructor
   *
   * @param {String} type - audio or video
   * @param {Object} meeting - the meeting object (used for reading current remote mute status)
   */
  constructor(type, meeting) {
    if ((type !== AUDIO) && (type !== VIDEO)) {
      throw new ParameterError('Mute state is designed for handling audio or video only');
    }
    this.type = type;
    this.state = {
      client: {
        localMute: false
      },
      server: {
        localMute: false,
        // initial values available only for audio (REMOTE_MUTE_VIDEO_MISSING_IMPLEMENTATION)
        remoteMute: type === AUDIO ? meeting.remoteMuted : false,
        unmuteAllowed: type === AUDIO ? meeting.unmuteAllowed : true
      },
      syncToServerInProgress: false
    };
    // these 2 hold the resolve, reject methods for the promise we returned to the client in last handleClientRequest() call
    this.pendingPromiseResolve = null;
    this.pendingPromiseReject = null;
  }

  /**
   * Handles mute/unmute request from the client/user. Returns a promise that's resolved once the server update is completed or
   * at the point that this request becomese superseded by another client request.
   *
   * The client doesn't have to wait for the returned promise to resolve before calling handleClientRequest() again. If
   * handleClientRequest() is called again before the previous one resolved, the MuteState class will make sure that eventually
   * the server state will match the last requested state from the client.
   *
   * @public
   * @memberof MuteState
   * @param {Object} [meeting] the meeting object
   * @param {Boolean} [mute] true for muting, false for unmuting request
   * @returns {Promise}
   */
  handleClientRequest(meeting, mute) {
    LoggerProxy.logger.info(`Meeting:muteState#handleClientRequest --> ${this.type}: user requesting new mute state: ${mute}`);

    if (!mute && !this.state.server.unmuteAllowed) {
      return Promise.reject(new PermissionError('User is not allowed to unmute self (hard mute feature is being used)'));
    }

    // we don't check if we're already in the same state, because even if we were, we would still have to apply the mute state locally,
    // because the client may have changed the audio/vidoe tracks
    this.state.client.localMute = mute;
    this.applyClientStateLocally(meeting);

    return new Promise((resolve, reject) => {
      if (this.pendingPromiseResolve) {
        // resolve the last promise we returned to the client as the client has issued a new request that has superseded the previous one
        this.pendingPromiseResolve();
      }
      this.pendingPromiseResolve = resolve;
      this.pendingPromiseReject = reject;
      this.applyClientStateToServer(meeting);
    });
  }

  /**
   * Applies the current mute state to the local track (by enabling or disabling it accordingly)
   *
   * @public
   * @param {Object} [meeting] the meeting object
   * @memberof MuteState
   * @returns {void}
   */
  applyClientStateLocally(meeting) {
    Media.setLocalTrack(
      !this.state.client.localMute,
      (this.type === AUDIO) ? meeting.mediaProperties.audioTrack : meeting.mediaProperties.videoTrack
    );
  }

  /**
   * Updates the server local and remote mute values so that they match the current client desired state.
   *
   * @private
   * @param {Object} [meeting] the meeting object
   * @memberof MuteState
   * @returns {void}
   */
  applyClientStateToServer(meeting) {
    if (this.state.syncToServerInProgress) {
      LoggerProxy.logger.info(`Meeting:muteState#applyClientStateToServer --> ${this.type}: request to server in progress, we need to wait for it to complete`);

      return;
    }

    const localMuteRequiresSync = (this.state.client.localMute !== this.state.server.localMute);
    const remoteMuteRequiresSync = (!this.state.client.localMute && this.state.server.remoteMute);

    LoggerProxy.logger.info(`Meeting:muteState#applyClientStateToServer --> ${this.type}: localMuteRequiresSync: ${localMuteRequiresSync} (${this.state.client.localMute} ?= ${this.state.server.localMute})`);
    LoggerProxy.logger.info(`Meeting:muteState#applyClientStateToServer --> ${this.type}: remoteMuteRequiresSync: ${remoteMuteRequiresSync}`);

    if (!localMuteRequiresSync && !remoteMuteRequiresSync) {
      LoggerProxy.logger.info(`Meeting:muteState#applyClientStateToServer --> ${this.type}: client state already matching server state, nothing to do`);

      if (this.pendingPromiseResolve) {
        this.pendingPromiseResolve();
      }
      this.pendingPromiseResolve = null;
      this.pendingPromiseReject = null;

      return;
    }

    this.state.syncToServerInProgress = true;

    // first sync local mute with server
    const localMuteSyncPromise = (localMuteRequiresSync) ? this.sendLocalMuteRequestToServer(meeting) : Promise.resolve();

    localMuteSyncPromise
      .then(() =>
        // then follow it up with remote mute sync
        ((remoteMuteRequiresSync) ? this.sendRemoteMuteRequestToServer(meeting) : Promise.resolve()))
      .then(() => {
        this.state.syncToServerInProgress = false;
        LoggerProxy.logger.info(`Meeting:muteState#applyClientStateToServer --> ${this.type}: sync with server completed`);

        // need to check if a new sync is required, because this.state.client may have changed while we were doing the current sync
        this.applyClientStateToServer(meeting);
      })
      .catch((e) => {
        this.state.syncToServerInProgress = false;

        if (this.pendingPromiseReject) {
          this.pendingPromiseReject(e);
        }
        this.pendingPromiseResolve = null;
        this.pendingPromiseReject = null;
      });
  }

  /**
   * Sets the local mute value in the server
   *
   * @private
   * @param {Object} [meeting] the meeting object
   * @memberof MuteState
   * @returns {Promise}
   */
  sendLocalMuteRequestToServer(meeting) {
    const audioMuted = (this.type === AUDIO) ? this.state.client.localMute : meeting.audio?.state.client.localMute;
    const videoMuted = (this.type === VIDEO) ? this.state.client.localMute : meeting.video?.state.client.localMute;

    LoggerProxy.logger.info(`Meeting:muteState#sendLocalMuteRequestToServer --> ${this.type}: sending local mute (audio=${audioMuted}, video=${videoMuted}) to server`);

    return MeetingUtil.remoteUpdateAudioVideo(audioMuted, videoMuted, meeting)
      .then((locus) => {
        LoggerProxy.logger.info(
          `Meeting:muteState#sendLocalMuteRequestToServer --> ${this.type}: local mute (audio=${audioMuted}, video=${videoMuted}) applied to server`
        );

        this.state.server.localMute = (this.type === AUDIO) ? audioMuted : videoMuted;

        meeting.locusInfo.onFullLocus(locus);

        return locus;
      })
      .catch((remoteUpdateError) => {
        LoggerProxy.logger.warn(
          `Meeting:muteState#sendLocalMuteRequestToServer --> ${this.type}: failed to apply local mute (audio=${audioMuted}, video=${videoMuted}) to server: ${remoteUpdateError}`
        );

        return Promise.reject(remoteUpdateError);
      });
  }


  /**
   * Sets the remote mute value in the server
   *
   * @private
   * @param {Object} [meeting] the meeting object
   * @memberof MuteState
   * @returns {Promise}
   */
  sendRemoteMuteRequestToServer(meeting) {
    if (this.type === AUDIO) {
      const remoteMute = this.state.client.localMute;

      LoggerProxy.logger.info(`Meeting:muteState#sendRemoteMuteRequestToServer --> ${this.type}: sending remote mute:${remoteMute} to server`);

      return meeting.members.muteMember(meeting.members.selfId, remoteMute)
        .then(() => {
          LoggerProxy.logger.info(
            `Meeting:muteState#sendRemoteMuteRequestToServer --> ${this.type}: remote mute:${remoteMute} applied to server`
          );

          this.state.server.remoteMute = remoteMute;
        })
        .catch((remoteUpdateError) => {
          LoggerProxy.logger.warn(
            `Meeting:muteState#sendRemoteMuteRequestToServer --> ${this.type}: failed to apply remote mute ${remoteMute} to server: ${remoteUpdateError}`
          );

          return Promise.reject(remoteUpdateError);
        });
    }

    // for now we don't need to support remote muting of video (REMOTE_MUTE_VIDEO_MISSING_IMPLEMENTATION)
    this.state.server.remoteMute = this.state.client.localMute;

    return Promise.resolve();
  }

  /**
   * This method should be called whenever the server remote mute state is changed
   *
   * @public
   * @memberof MuteState
   * @param {Boolean} [muted] true if user is remotely muted, false otherwise
   * @param {Boolean} [unmuteAllowed] indicates if user is allowed to unmute self (false when "hard mute" feature is used)
   * @returns {undefined}
   */
  handleServerRemoteMuteUpdate(muted, unmuteAllowed) {
    LoggerProxy.logger.info(`Meeting:muteState#handleServerRemoteMuteUpdate --> ${this.type}: updating server remoteMute to (${muted})`);
    this.state.server.remoteMute = muted;
    this.state.server.unmuteAllowed = unmuteAllowed;
  }

  /**
   * This method should be called whenever we receive from the server a requirement to locally unmute
   *
   * @public
   * @memberof MuteState
   * @param {Object} [meeting] the meeting object
   * @returns {undefined}
   */
  handleServerLocalUnmuteRequired(meeting) {
    LoggerProxy.logger.info(`Meeting:muteState#handleServerLocalUnmuteRequired --> ${this.type}: localAudioUnmuteRequired received -> doing local unmute`);

    this.state.server.remoteMute = false;
    this.state.client.localMute = false;

    if (this.pendingPromiseReject) {
      this.pendingPromiseReject(new Error('Server requested local unmute - this overrides any client request in progress'));
      this.pendingPromiseResolve = null;
      this.pendingPromiseReject = null;
    }

    this.applyClientStateLocally(meeting);
    this.applyClientStateToServer(meeting);
  }

  /**
   * Returns true if the user is locally or remotely muted
   *
   * @public
   * @memberof MuteState
   * @returns {Boolean}
   */
  isMuted() {
    return this.state.client.localMute || this.state.server.localMute || this.state.server.remoteMute;
  }

  /**
   * Returns true if the user is muted as a result of the client request (and not remotely muted)
   *
   * @public
   * @memberof MuteState
   * @returns {Boolean}
   */
  isSelf() {
    return this.state.client.localMute && !this.state.server.remoteMute;
  }

  // defined for backwards compatibility with the old AudioStateMachine/VideoStateMachine classes
  get muted() {
    return this.isMuted();
  }

  // defined for backwards compatibility with the old AudioStateMachine/VideoStateMachine classes
  get self() {
    return this.isSelf();
  }
}

export default createMuteState;
