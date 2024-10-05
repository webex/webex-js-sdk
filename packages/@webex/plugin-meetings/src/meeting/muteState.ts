import {ServerMuteReason} from '@webex/media-helpers';
import LoggerProxy from '../common/logs/logger-proxy';
import ParameterError from '../common/errors/parameter';
import MeetingUtil from './util';
import {AUDIO, VIDEO} from '../constants';

// eslint-disable-next-line import/prefer-default-export
export const createMuteState = (type, meeting, enabled: boolean) => {
  // todo: remove the meeting argument  (SPARK-399695)

  LoggerProxy.logger.info(
    `Meeting:muteState#createMuteState --> ${type}: creating MuteState for meeting id ${meeting?.id}`
  );

  const muteState = new MuteState(type, meeting, enabled);

  return muteState;
};

/** The purpose of this class is to manage the local and remote mute state and make sure that the server state always matches
   the last requested state by the client.

   More info about Locus muting API: https://sqbu-github.cisco.com/pages/WebExSquared/locus/guides/mute.html#

   This class is exported only for unit tests. It should never be instantiated directly with new MuteState(), instead createMuteState() should be called
*/
export class MuteState {
  state: {
    client: {
      enabled: boolean; // indicates if audio/video is enabled at all or not
      localMute: boolean;
    };
    server: {localMute: boolean; remoteMute: boolean; unmuteAllowed: boolean};
    syncToServerInProgress: boolean;
  };

  type: any;
  ignoreMuteStateChange: boolean;

  /**
   * Constructor
   *
   * @param {String} type - audio or video
   * @param {Object} meeting - the meeting object (used for reading current remote mute status)
   * @param {boolean} enabled - whether the client audio/video is enabled at all
   */
  constructor(type: string, meeting: any, enabled: boolean) {
    if (type !== AUDIO && type !== VIDEO) {
      throw new ParameterError('Mute state is designed for handling audio or video only');
    }
    this.type = type;
    this.ignoreMuteStateChange = false;
    this.state = {
      client: {
        enabled,
        localMute: true,
      },
      server: {
        localMute: true,
        // because remoteVideoMuted and unmuteVideoAllowed are updated seperately, they might be undefined
        remoteMute: type === AUDIO ? meeting.remoteMuted : meeting.remoteVideoMuted ?? false,
        unmuteAllowed: type === AUDIO ? meeting.unmuteAllowed : meeting.unmuteVideoAllowed ?? true,
      },
      syncToServerInProgress: false,
    };
  }

  /**
   * Starts the mute state machine. Needs to be called after a new MuteState instance is created.
   *
   * @param {Object} meeting - the meeting object
   * @returns {void}
   */
  public init(meeting: any) {
    this.applyUnmuteAllowedToStream(meeting);

    // if we are remotely muted, we need to apply that to the local stream now (mute on-entry)
    if (this.state.server.remoteMute) {
      this.muteLocalStream(meeting, this.state.server.remoteMute, 'remotelyMuted');
    }

    const initialMute =
      this.type === AUDIO
        ? meeting.mediaProperties.audioStream?.muted
        : meeting.mediaProperties.videoStream?.muted;

    LoggerProxy.logger.info(
      `Meeting:muteState#init --> ${this.type}: local stream initial mute state: ${initialMute}`
    );

    if (initialMute !== undefined) {
      this.state.client.localMute = initialMute;
    } else {
      // there is no stream, so it's like we are locally muted
      // (this is important especially for transcoded meetings, in which the SDP m-line direction always stays "sendrecv")
      this.state.client.localMute = true;
    }
    this.applyClientStateToServer(meeting);
  }

  /**
   * This method needs to be called whenever the local audio/video stream has changed.
   * It reapplies the remote mute state onto the new stream and also reads the current
   * local mute state from the stream and updates the internal state machine and sends
   * any required requests to the server.
   *
   * @param {Object} meeting - the meeting object
   * @returns {void}
   */
  public handleLocalStreamChange(meeting: any) {
    return this.init(meeting);
  }

  /**
   * Enables/disables audio/video
   *
   * @param {Object} meeting - the meeting object
   * @param {boolean} enable
   * @returns {void}
   */
  public enable(meeting: any, enable: boolean) {
    this.state.client.enabled = enable;

    this.applyClientStateToServer(meeting);
  }

  /**
   * Mutes/unmutes local stream
   *
   * @param {Object} meeting - the meeting object
   * @param {Boolean} mute - true to mute the stream, false to unmute it
   * @param {ServerMuteReason} reason - reason for muting/unmuting
   * @returns {void}
   */
  private muteLocalStream(meeting: any, mute: boolean, reason: ServerMuteReason) {
    this.ignoreMuteStateChange = true;
    if (this.type === AUDIO) {
      meeting.mediaProperties.audioStream?.setServerMuted(mute, reason);
    } else {
      meeting.mediaProperties.videoStream?.setServerMuted(mute, reason);
    }
    this.ignoreMuteStateChange = false;
  }

  /**
   * This method should be called when the local stream mute state is changed
   * @public
   * @memberof MuteState
   * @param {Object} [meeting] the meeting object
   * @param {Boolean} [mute] true for muting, false for unmuting request
   * @returns {void}
   */
  public handleLocalStreamMuteStateChange(meeting?: any) {
    if (this.ignoreMuteStateChange) {
      return;
    }

    // either user or system may have triggered a mute state change, but localMute should reflect both
    let newMuteState: boolean;
    let userMuteState: boolean;
    let systemMuteState: boolean;
    if (this.type === AUDIO) {
      newMuteState = meeting.mediaProperties.audioStream?.muted;
      userMuteState = meeting.mediaProperties.audioStream?.userMuted;
      systemMuteState = meeting.mediaProperties.audioStream?.systemMuted;
    } else {
      newMuteState = meeting.mediaProperties.videoStream?.muted;
      userMuteState = meeting.mediaProperties.videoStream?.userMuted;
      systemMuteState = meeting.mediaProperties.videoStream?.systemMuted;
    }

    LoggerProxy.logger.info(
      `Meeting:muteState#handleLocalStreamMuteStateChange --> ${this.type}: local stream new mute state: ${newMuteState} (user mute: ${userMuteState}, system mute: ${systemMuteState})`
    );

    this.state.client.localMute = newMuteState;

    this.applyClientStateToServer(meeting);
  }

  /**
   * Applies the current mute state to the local stream (by enabling or disabling it accordingly)
   *
   * @public
   * @param {Object} [meeting] the meeting object
   * @param {ServerMuteReason} reason - reason why we're applying our client state to the local stream
   * @memberof MuteState
   * @returns {void}
   */
  public applyClientStateLocally(meeting?: any, reason?: ServerMuteReason) {
    this.muteLocalStream(meeting, this.state.client.localMute, reason);
  }

  /** Returns true if client is locally muted - it takes into account not just the client local mute state,
   *  but also whether audio/video is enabled at all
   *
   * @returns {boolean}
   */
  private getClientLocalMuteState() {
    return this.state.client.enabled ? this.state.client.localMute : true;
  }

  /**
   * Updates the server local and remote mute values so that they match the current client desired state.
   *
   * @private
   * @param {Object} [meeting] the meeting object
   * @memberof MuteState
   * @returns {void}
   */
  private applyClientStateToServer(meeting?: any) {
    if (this.state.syncToServerInProgress) {
      LoggerProxy.logger.info(
        `Meeting:muteState#applyClientStateToServer --> ${this.type}: request to server in progress, we need to wait for it to complete`
      );

      return;
    }

    const localMuteState = this.getClientLocalMuteState();
    const localMuteRequiresSync = localMuteState !== this.state.server.localMute;
    const remoteMuteRequiresSync = !localMuteState && this.state.server.remoteMute;

    LoggerProxy.logger.info(
      `Meeting:muteState#applyClientStateToServer --> ${this.type}: localMuteRequiresSync: ${localMuteRequiresSync} (${localMuteState} ?= ${this.state.server.localMute})`
    );
    LoggerProxy.logger.info(
      `Meeting:muteState#applyClientStateToServer --> ${this.type}: remoteMuteRequiresSync: ${remoteMuteRequiresSync}`
    );

    if (!localMuteRequiresSync && !remoteMuteRequiresSync) {
      LoggerProxy.logger.info(
        `Meeting:muteState#applyClientStateToServer --> ${this.type}: client state already matching server state, nothing to do`
      );

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

        LoggerProxy.logger.warn(
          `Meeting:muteState#applyClientStateToServer --> ${this.type}: error: ${e}`
        );

        // failed to apply client state to server, so revert stream mute state to server state
        this.muteLocalStream(
          meeting,
          this.state.server.localMute || this.state.server.remoteMute,
          'clientRequestFailed'
        );
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
    const audioMuted = this.type === AUDIO ? this.getClientLocalMuteState() : undefined;
    const videoMuted = this.type === VIDEO ? this.getClientLocalMuteState() : undefined;

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
          meeting.locusInfo.handleLocusDelta(locus, meeting);
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
    const remoteMute = this.getClientLocalMuteState();

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

  /** Applies the current value for unmute allowed to the underlying stream
   *
   * @param {Meeting} meeting
   * @returns {void}
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private applyUnmuteAllowedToStream(meeting: any) {
    if (this.type === AUDIO) {
      meeting.mediaProperties.audioStream?.setUnmuteAllowed(this.state.server.unmuteAllowed);
    } else {
      meeting.mediaProperties.videoStream?.setUnmuteAllowed(this.state.server.unmuteAllowed);
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
      this.applyUnmuteAllowedToStream(meeting);
    }
    if (muted !== undefined) {
      this.state.server.remoteMute = muted;

      // We never want to unmute the local stream from a server remote mute update.
      // Moderated unmute is handled by a different function.
      if (muted) {
        this.muteLocalStream(meeting, muted, 'remotelyMuted');
      }
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
  public handleServerLocalUnmuteRequired(meeting?: any) {
    if (!this.state.client.enabled) {
      LoggerProxy.logger.warn(
        `Meeting:muteState#handleServerLocalUnmuteRequired --> ${this.type}: localAudioUnmuteRequired received while ${this.type} is disabled -> local unmute will not result in ${this.type} being sent`
      );
    } else {
      LoggerProxy.logger.info(
        `Meeting:muteState#handleServerLocalUnmuteRequired --> ${this.type}: localAudioUnmuteRequired received -> doing local unmute`
      );
    }

    // todo: I'm seeing "you can now unmute yourself " popup  when this happens - but same thing happens on web.w.c so we can ignore for now
    this.state.server.remoteMute = false;

    // change user mute state to false, but keep localMute true if overall mute state is still true
    this.muteLocalStream(meeting, false, 'localUnmuteRequired');
    if (this.type === AUDIO) {
      this.state.client.localMute = meeting.mediaProperties.audioStream?.muted;
    } else {
      this.state.client.localMute = meeting.mediaProperties.videoStream?.muted;
    }

    this.applyClientStateToServer(meeting);
  }

  /**
   * Returns true if the user is locally or remotely muted.
   * It only checks the mute status, ignoring the fact whether audio/video is enabled.
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
   * Returns true if the user is locally muted or audio/video is disabled
   *
   * @public
   * @memberof MuteState
   * @returns {Boolean}
   */
  public isLocallyMuted() {
    return this.getClientLocalMuteState();
  }
}
