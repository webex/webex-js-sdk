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

// temporary hack: duplicate implementation in LocalMicrophoneTrack and LocalCameraTrack
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

  setMuted(muted: boolean): Promise<void> {
    console.log(`marcin: mic setMuted hijacked! muted=${muted}, this=${this}`);

    if (!muted) {
      if (!this.isUnmuteAllowed()) {
        return Promise.reject(Error('Unmute is not allowed'));
      }
    }
    super.setMuted(muted);

    return Promise.resolve();
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

  setMuted(muted: boolean): Promise<void> {
    console.log(`marcin: camera setMuted hijacked! muted=${muted}, this=${this}`);

    if (!muted) {
      if (!this.isUnmuteAllowed()) {
        return Promise.reject(Error('Unmute is not allowed'));
      }
    }
    super.setMuted(muted);

    return Promise.resolve();
  }
}

export const createMicrophoneTrack = (constraints?: AudioDeviceConstraints) =>
  wcmeCreateMicrophoneTrack(LocalMicrophoneTrack, constraints);

export const createCameraTrack = (constraints?: VideoDeviceConstraints) =>
  wcmeCreateCameraTrack(LocalCameraTrack, constraints);

export const createDisplayTrack = () => wcmeCreateDisplayTrack(LocalDisplayTrack);
