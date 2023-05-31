/* eslint-disable @typescript-eslint/no-misused-new */
/* eslint-disable valid-jsdoc */
/* eslint-disable require-jsdoc */
import {
  AudioDeviceConstraints,
  createCameraTrack as wcmeCreateCameraTrack,
  createDisplayTrack as wcmeCreateDisplayTrack,
  createMicrophoneTrack as wcmeCreateMicrophoneTrack,
  LocalDisplayTrack,
  LocalMicrophoneTrack as WcmeLocalMicrophoneTrack,
  LocalCameraTrack as WcmeLocalCameraTrack,
  VideoDeviceConstraints,
} from '@webex/internal-media-core';

export {
  LocalTrack,
  LocalDisplayTrack,
  LocalTrackEvents,
  type TrackMuteEvent,
} from '@webex/internal-media-core';

export type ServerMuteReason =
  | 'remotelyMuted' // other user has remotely muted us
  | 'clientRequestFailed' // client called setMuted() but server request failed
  | 'localUnmuteRequired'; // server forced the client to be unmuted

// these events are in addition to WCME events. This will be properly typed once webrtc-core event types inheritance is fixed
export enum LocalMicrophoneTrackEvents {
  ServerMuted = 'muted:byServer',
}

// these events are in addition to WCME events. This will be properly typed once webrtc-core event types inheritance is fixed
export enum LocalCameraTrackEvents {
  ServerMuted = 'muted:byServer',
}

export class LocalMicrophoneTrack extends WcmeLocalMicrophoneTrack {
  private unmuteAllowed = true;

  /**
   * @internal
   */
  setUnmuteAllowed(allowed) {
    this.unmuteAllowed = allowed;
  }

  /**
   * @returns true if user is allowed to unmute the track, false otherwise
   */
  isUnmuteAllowed() {
    return this.unmuteAllowed;
  }

  setMuted(muted: boolean): void {
    if (!muted) {
      if (!this.isUnmuteAllowed()) {
        throw new Error('Unmute is not allowed');
      }
    }

    return super.setMuted(muted);
  }

  /**
   * @internal
   */
  setServerMuted(muted: boolean, reason: ServerMuteReason) {
    if (muted !== this.muted) {
      this.setMuted(muted);
      this.emit(LocalMicrophoneTrackEvents.ServerMuted, {muted, reason});
    }
  }
}

export class LocalCameraTrack extends WcmeLocalCameraTrack {
  private unmuteAllowed = true;

  /**
   * @internal
   */
  setUnmuteAllowed(allowed) {
    this.unmuteAllowed = allowed;
  }

  /**
   * @returns true if user is allowed to unmute the track, false otherwise
   */
  isUnmuteAllowed() {
    return this.unmuteAllowed;
  }

  setMuted(muted: boolean): void {
    if (!muted) {
      if (!this.isUnmuteAllowed()) {
        throw new Error('Unmute is not allowed');
      }
    }

    return super.setMuted(muted);
  }

  /**
   * @internal
   */
  setServerMuted(muted: boolean, reason: ServerMuteReason) {
    if (muted !== this.muted) {
      this.setMuted(muted);
      this.emit(LocalCameraTrackEvents.ServerMuted, {muted, reason});
    }
  }
}

export const createMicrophoneTrack = (constraints?: AudioDeviceConstraints) =>
  wcmeCreateMicrophoneTrack(LocalMicrophoneTrack, constraints);

export const createCameraTrack = (constraints?: VideoDeviceConstraints) =>
  wcmeCreateCameraTrack(LocalCameraTrack, constraints);

export const createDisplayTrack = () => wcmeCreateDisplayTrack(LocalDisplayTrack);
