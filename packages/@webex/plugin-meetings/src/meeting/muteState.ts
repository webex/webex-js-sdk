import {ServerMuteReason} from '@webex/media-helpers';
import LoggerProxy from '../common/logs/logger-proxy';
import ParameterError from '../common/errors/parameter';
import PermissionError from '../common/errors/permission';
import MeetingUtil from './util';
import {AUDIO, VIDEO} from '../constants';
/* Certain aspects of server interaction for video muting are not implemented as we currently don't support remote muting of video.
   If we ever need to support it, search for REMOTE_MUTE_VIDEO_MISSING_IMPLEMENTATION string to find the places that need updating
*/

// eslint-disable-next-line import/prefer-default-export
export const createMuteState = (type, meeting, mediaDirection, sdkOwnsLocalTrack: boolean) => {
  // todo: remove mediaDirection argument (SPARK-399695)
  // todo: remove the meeting argument  (SPARK-399695)
  if (type === AUDIO && !mediaDirection.sendAudio) {
    return null;
  }
  if (type === VIDEO && !mediaDirection.sendVideo) {
    return null;
  }

  LoggerProxy.logger.info(
    `Meeting:muteState#createMuteState --> ${type}: creating MuteState for meeting id ${meeting?.id}`
  );

  const muteState = new MuteState(type, meeting, sdkOwnsLocalTrack);

  muteState.init(meeting);

  return muteState;
};

/** The purpose of this class is to manage the local and remote mute state and make sure that the server state always matches
   the last requested state by the client.

   More info about Locus muting API: https://sqbu-github.cisco.com/pages/WebExSquared/locus/guides/mute.html#

   This class is exported only for unit tests. It should never be instantiated directly with new MuteState(), instead createMuteState() should be called
*/
export class MuteState {
  pendingPromiseReject: any;
  pendingPromiseResolve: any;
  state: any;
  type: any;
  sdkOwnsLocalTrack: boolean; // todo: remove this when doing SPARK-399695
  ignoreMuteStateChange: boolean;

  /**
   * Constructor
   *
   * @param {String} type - audio or video
   * @param {Object} meeting - the meeting object (used for reading current remote mute status)
   * @param {boolean} sdkOwnsLocalTrack - if false, then client app owns the local track (for now that's the case only for multistream meetings)
   */
  constructor(type: string, meeting: any, sdkOwnsLocalTrack: boolean) {
    if (type !== AUDIO && type !== VIDEO) {
      throw new ParameterError('Mute state is designed for handling audio or video only');
    }
    this.type = type;
    this.sdkOwnsLocalTrack = sdkOwnsLocalTrack;
    this.ignoreMuteStateChange = false;
    this.state = {
      client: {
        localMute: false,
      },
      server: {
        localMute: true,
        // because remoteVideoMuted and unmuteVideoAllowed are updated seperately, they might be undefined
        remoteMute: type === AUDIO ? meeting.remoteMuted : meeting.remoteVideoMuted ?? false,
        unmuteAllowed: type === AUDIO ? meeting.unmuteAllowed : meeting.unmuteVideoAllowed ?? true,
      },
      syncToServerInProgress: false,
    };
    // these 2 hold the resolve, reject methods for the promise we returned to the client in last handleClientRequest() call
    this.pendingPromiseResolve = null;
    this.pendingPromiseReject = null;
  }

  /**
   * Starts the mute state machine. Needs to be called after a new MuteState instance is created.
   *
   * @param {Object} meeting - the meeting object
   * @returns {void}
   */
  public init(meeting: any) {
    if (!this.sdkOwnsLocalTrack) {
      this.applyUnmuteAllowedToTrack(meeting);

      // if we are remotely muted, we need to apply that to the local track now (mute on-entry)
      if (this.state.server.remoteMute) {
        this.muteLocalTrack(meeting, this.state.server.remoteMute, 'remotelyMuted');
      }

      const initialMute =
        this.type === AUDIO
          ? meeting.mediaProperties.audioTrack?.muted
          : meeting.mediaProperties.videoTrack?.muted;

      LoggerProxy.logger.info(
        `Meeting:muteState#init --> ${this.type}: local track initial mute state: ${initialMute}`
      );

      if (initialMute !== undefined) {
        this.state.client.localMute = initialMute;

        this.applyClientStateToServer(meeting);
      }
    } else {
      // in the mode where sdkOwnsLocalTrack is false (transcoded meetings),
      // SDK API currently doesn't allow to start with audio/video muted,
      // so we need to apply the initial local mute state (false) to server
      this.state.syncToServerInProgress = true;
      this.sendLocalMuteRequestToServer(meeting)
        .then(() => {
          this.state.syncToServerInProgress = false;
        })
        .catch(() => {
          this.state.syncToServerInProgress = false;
          // not much we can do here...
        });
    }
  }

  /**
   * This method needs to be called whenever the local audio/video track has changed.
   * It reapplies the remote mute state onto the new track and also reads the current
   * local mute state from the track and updates the internal state machine and sends
   * any required requests to the server.
   *
   * @param {Object} meeting - the meeting object
   * @returns {void}
   */
  public handleLocalTrackChange(meeting: any) {
    return this.init(meeting);
  }

  /**
   * Mutes/unmutes local track
   *
   * @param {Object} meeting - the meeting object
   * @param {Boolean} mute - true to mute the track, false to unmute it
   * @param {ServerMuteReason} reason - reason for muting/unmuting
   * @returns {void}
   */
  private muteLocalTrack(meeting: any, mute: boolean, reason: ServerMuteReason) {
    this.ignoreMuteStateChange = true;
    if (this.type === AUDIO) {
      meeting.mediaProperties.audioTrack?.setServerMuted(mute, reason);
    } else {
      meeting.mediaProperties.videoTrack?.setServerMuted(mute, reason);
    }
    this.ignoreMuteStateChange = false;
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
  public handleClientRequest(meeting: object, mute?: boolean) {
    // todo: this whole method will be removed in SPARK-399695
    LoggerProxy.logger.info(
      `Meeting:muteState#handleClientRequest --> ${this.type}: user requesting new mute state: ${mute}`
    );

    if (!mute && !this.state.server.unmuteAllowed) {
      return Promise.reject(
        new PermissionError('User is not allowed to unmute self (hard mute feature is being used)')
      );
    }

    // we don't check if we're already in the same state, because even if we were, we would still have to apply the mute state locally,
    // because the client may have changed the audio/video tracks
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
   * This method should be called when the local track mute state is changed
   * @public
   * @memberof MuteState
   * @param {Object} [meeting] the meeting object
   * @param {Boolean} [mute] true for muting, false for unmuting request
   * @returns {void}
   */
  public handleLocalTrackMuteStateChange(meeting?: object, mute?: boolean) {
    if (this.ignoreMuteStateChange) {
      return;
    }
    LoggerProxy.logger.info(
      `Meeting:muteState#handleLocalTrackMuteStateChange --> ${this.type}: local track new mute state: ${mute}`
    );

    if (this.pendingPromiseReject) {
      LoggerProxy.logger.error(
        `Meeting:muteState#handleLocalTrackMuteStateChange --> ${this.type}: Local track mute state change handler called while a client request is handled - this should never happen!, mute state: ${mute}`
      );
    }

    this.state.client.localMute = mute;

    this.applyClientStateToServer(meeting);
  }

  /**
   * Applies the current mute state to the local track (by enabling or disabling it accordingly)
   *
   * @public
   * @param {Object} [meeting] the meeting object
   * @param {ServerMuteReason} reason - reason why we're applying our client state to the local track
   * @memberof MuteState
   * @returns {void}
   */
  public applyClientStateLocally(meeting?: any, reason?: ServerMuteReason) {
    if (this.sdkOwnsLocalTrack) {
      if (this.type === AUDIO) {
        meeting.mediaProperties.audioTrack?.setMuted(this.state.client.localMute);
      } else {
        meeting.mediaProperties.videoTrack?.setMuted(this.state.client.localMute);
      }
    } else {
      this.muteLocalTrack(meeting, this.state.client.localMute, reason);
    }
  }

  /**
   * Updates the server local and remote mute values so that they match the current client desired state.
   *
   * @private
   * @param {Object} [meeting] the meeting object
   * @memberof MuteState
   * @returns {void}
   */
  private applyClientStateToServer(meeting?: object) {
    if (this.state.syncToServerInProgress) {
      LoggerProxy.logger.info(
        `Meeting:muteState#applyClientStateToServer --> ${this.type}: request to server in progress, we need to wait for it to complete`
      );

      return;
    }

    const localMuteRequiresSync = this.state.client.localMute !== this.state.server.localMute;
    const remoteMuteRequiresSync = !this.state.client.localMute && this.state.server.remoteMute;

    LoggerProxy.logger.info(
      `Meeting:muteState#applyClientStateToServer --> ${this.type}: localMuteRequiresSync: ${localMuteRequiresSync} (${this.state.client.localMute} ?= ${this.state.server.localMute})`
    );
    LoggerProxy.logger.info(
      `Meeting:muteState#applyClientStateToServer --> ${this.type}: remoteMuteRequiresSync: ${remoteMuteRequiresSync}`
    );

    if (!localMuteRequiresSync && !remoteMuteRequiresSync) {
      LoggerProxy.logger.info(
        `Meeting:muteState#applyClientStateToServer --> ${this.type}: client state already matching server state, nothing to do`
      );

      if (this.pendingPromiseResolve) {
        this.pendingPromiseResolve();
      }
      this.pendingPromiseResolve = null;
      this.pendingPromiseReject = null;

      return;
    }

    this.state.syncToServerInProgress = true;

    // first sync local mute with server
    const localMuteSyncPromise = localMuteRequiresSync
      ? this.sendLocalMuteRequestToServer(meeting)
      : Promise.resolve();

    localMuteSyncPromise
      .then(() =>
        // then follow it up with remote mute sync
        remoteMuteRequiresSync ? this.sendRemoteMuteRequestToServer(meeting) : Promise.resolve()
      )
      .then(() => {
        this.state.syncToServerInProgress = false;
        LoggerProxy.logger.info(
          `Meeting:muteState#applyClientStateToServer --> ${this.type}: sync with server completed`
        );

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

        this.applyServerMuteToLocalTrack(meeting, 'clientRequestFailed');
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
  private sendLocalMuteRequestToServer(meeting?: any) {
    const audioMuted = this.type === AUDIO ? this.state.client.localMute : undefined;
    const videoMuted = this.type === VIDEO ? this.state.client.localMute : undefined;

    LoggerProxy.logger.info(
      `Meeting:muteState#sendLocalMuteRequestToServer --> ${this.type}: sending local mute (audio=${audioMuted}, video=${videoMuted}) to server`
    );

    return MeetingUtil.remoteUpdateAudioVideo(meeting, audioMuted, videoMuted)
      .then((locus) => {
        LoggerProxy.logger.info(
          `Meeting:muteState#sendLocalMuteRequestToServer --> ${this.type}: local mute (audio=${audioMuted}, video=${videoMuted}) applied to server`
        );

        this.state.server.localMute = this.type === AUDIO ? audioMuted : videoMuted;

        if (locus) {
          meeting.locusInfo.onFullLocus(locus);
        }

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
  private sendRemoteMuteRequestToServer(meeting?: any) {
    const remoteMute = this.state.client.localMute;

    LoggerProxy.logger.info(
      `Meeting:muteState#sendRemoteMuteRequestToServer --> ${this.type}: sending remote mute:${remoteMute} to server`
    );

    return meeting.members
      .muteMember(meeting.members.selfId, remoteMute, this.type === AUDIO)
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

  /** Sets the mute state of the local track according to what server thinks is our state
   * @param {Object} meeting - the meeting object
   * @param {ServerMuteReason} serverMuteReason - reason why we're applying server mute to the local track
   * @returns {void}
   */
  private applyServerMuteToLocalTrack(meeting: any, serverMuteReason: ServerMuteReason) {
    if (!this.sdkOwnsLocalTrack) {
      const muted = this.state.server.localMute || this.state.server.remoteMute;

      // update the local track mute state, but not this.state.client.localMute
      this.muteLocalTrack(meeting, muted, serverMuteReason);
    }
  }

  /** Applies the current value for unmute allowed to the underlying track
   *
   * @param {Meeting} meeting
   * @returns {void}
   */
  private applyUnmuteAllowedToTrack(meeting: any) {
    if (!this.sdkOwnsLocalTrack) {
      if (this.type === AUDIO) {
        meeting.mediaProperties.audioTrack?.setUnmuteAllowed(this.state.server.unmuteAllowed);
      } else {
        meeting.mediaProperties.videoTrack?.setUnmuteAllowed(this.state.server.unmuteAllowed);
      }
    }
  }

  /**
   * This method should be called whenever the server remote mute state is changed
   *
   * @public
   * @memberof MuteState
   * @param {Meeting} meeting
   * @param {Boolean} [muted] true if user is remotely muted, false otherwise
   * @param {Boolean} [unmuteAllowed] indicates if user is allowed to unmute self (false when "hard mute" feature is used)
   * @returns {undefined}
   */
  public handleServerRemoteMuteUpdate(meeting: any, muted?: boolean, unmuteAllowed?: boolean) {
    LoggerProxy.logger.info(
      `Meeting:muteState#handleServerRemoteMuteUpdate --> ${this.type}: updating server remoteMute to (${muted})`
    );
    if (unmuteAllowed !== undefined) {
      this.state.server.unmuteAllowed = unmuteAllowed;
      this.applyUnmuteAllowedToTrack(meeting);
    }
    if (muted !== undefined) {
      this.state.server.remoteMute = muted;
      this.applyServerMuteToLocalTrack(meeting, 'remotelyMuted');
    }
  }

  /**
   * This method should be called whenever we receive from the server a requirement to locally unmute
   *
   * @public
   * @memberof MuteState
   * @param {Object} [meeting] the meeting object
   * @returns {undefined}
   */
  public handleServerLocalUnmuteRequired(meeting?: object) {
    LoggerProxy.logger.info(
      `Meeting:muteState#handleServerLocalUnmuteRequired --> ${this.type}: localAudioUnmuteRequired received -> doing local unmute`
    );

    // todo: I'm seeing "you can now unmute yourself " popup  when this happens - but same thing happens on web.w.c so we can ignore for now
    this.state.server.remoteMute = false;
    this.state.client.localMute = false;

    if (this.pendingPromiseReject) {
      this.pendingPromiseReject(
        new Error('Server requested local unmute - this overrides any client request in progress')
      );
      this.pendingPromiseResolve = null;
      this.pendingPromiseReject = null;
    }

    this.applyClientStateLocally(meeting, 'localUnmuteRequired');
    this.applyClientStateToServer(meeting);
  }

  /**
   * Returns true if the user is locally or remotely muted
   *
   * @public
   * @memberof MuteState
   * @returns {Boolean}
   */
  public isMuted() {
    return (
      this.state.client.localMute || this.state.server.localMute || this.state.server.remoteMute
    );
  }

  /**
   * Returns true if the user is remotely muted
   *
   * @public
   * @memberof MuteState
   * @returns {Boolean}
   */
  public isRemotelyMuted() {
    return this.state.server.remoteMute;
  }

  /**
   * Returns true if unmute is allowed
   *
   * @public
   * @memberof MuteState
   * @returns {Boolean}
   */
  public isUnmuteAllowed() {
    return this.state.server.unmuteAllowed;
  }

  /**
   * Returns true if the user is locally muted
   *
   * @public
   * @memberof MuteState
   * @returns {Boolean}
   */
  public isLocallyMuted() {
    return this.state.client.localMute || this.state.server.localMute;
  }

  /**
   * Returns true if the user is muted as a result of the client request (and not remotely muted)
   *
   * @public
   * @memberof MuteState
   * @returns {Boolean}
   */
  public isSelf() {
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
