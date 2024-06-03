/* eslint-disable @typescript-eslint/no-misused-new */
/* eslint-disable valid-jsdoc */
/* eslint-disable require-jsdoc */
import {
  AudioDeviceConstraints,
  createCameraStream as wcmeCreateCameraStream,
  createDisplayStream as wcmeCreateDisplayStream,
  createDisplayStreamWithAudio as wcmeCreateDisplayStreamWithAudio,
  createMicrophoneStream as wcmeCreateMicrophoneStream,
  LocalDisplayStream,
  LocalSystemAudioStream,
  LocalMicrophoneStream as WcmeLocalMicrophoneStream,
  LocalCameraStream as WcmeLocalCameraStream,
  VideoDeviceConstraints,
} from '@webex/internal-media-core';
import {AddEvents, TypedEvent, WithEventsDummyType} from '@webex/ts-events';

export {
  getDevices,
  LocalStream,
  LocalDisplayStream,
  LocalSystemAudioStream,
  LocalStreamEventNames,
  StreamEventNames,
  RemoteStream,
  RemoteStreamEventNames,
  type VideoContentHint,
} from '@webex/internal-media-core';

export type ServerMuteReason =
  | 'remotelyMuted' // other user has remotely muted us
  | 'clientRequestFailed' // client called setUserMuted() but server request failed
  | 'localUnmuteRequired'; // server forced the client to be unmuted

// these events are in addition to WCME events. This will be properly typed once webrtc-core event types inheritance is fixed
export enum LocalMicrophoneStreamEventNames {
  ServerMuted = 'muted:byServer',
}

// these events are in addition to WCME events. This will be properly typed once webrtc-core event types inheritance is fixed
export enum LocalCameraStreamEventNames {
  ServerMuted = 'muted:byServer',
}

interface LocalMicrophoneStreamEvents {
  [LocalMicrophoneStreamEventNames.ServerMuted]: TypedEvent<
    (muted: boolean, reason: ServerMuteReason) => void
  >;
}

interface LocalCameraStreamEvents {
  [LocalCameraStreamEventNames.ServerMuted]: TypedEvent<
    (muted: boolean, reason: ServerMuteReason) => void
  >;
}

class _LocalMicrophoneStream extends WcmeLocalMicrophoneStream {
  private unmuteAllowed = true;

  [LocalMicrophoneStreamEventNames.ServerMuted] = new TypedEvent<
    (muted: boolean, reason: ServerMuteReason) => void
  >();

  /**
   * @internal
   */
  setUnmuteAllowed(allowed: boolean) {
    this.unmuteAllowed = allowed;
  }

  /**
   * @returns true if user is allowed to unmute the track, false otherwise
   */
  isUnmuteAllowed() {
    return this.unmuteAllowed;
  }

  setUserMuted(muted: boolean): void {
    if (!muted) {
      if (!this.isUnmuteAllowed()) {
        throw new Error('Unmute is not allowed');
      }
    }

    return super.setUserMuted(muted);
  }

  /**
   * @internal
   */
  setServerMuted(muted: boolean, reason: ServerMuteReason) {
    if (muted !== this.userMuted) {
      this.setUserMuted(muted);
      this[LocalMicrophoneStreamEventNames.ServerMuted].emit(muted, reason);
    }
  }
}

class _LocalCameraStream extends WcmeLocalCameraStream {
  private unmuteAllowed = true;

  [LocalCameraStreamEventNames.ServerMuted] = new TypedEvent<
    (muted: boolean, reason: ServerMuteReason) => void
  >();

  /**
   * @internal
   */
  setUnmuteAllowed(allowed: boolean) {
    this.unmuteAllowed = allowed;
  }

  /**
   * @returns true if user is allowed to unmute the track, false otherwise
   */
  isUnmuteAllowed() {
    return this.unmuteAllowed;
  }

  setUserMuted(muted: boolean): void {
    if (!muted) {
      if (!this.isUnmuteAllowed()) {
        throw new Error('Unmute is not allowed');
      }
    }

    return super.setUserMuted(muted);
  }

  /**
   * @internal
   */
  setServerMuted(muted: boolean, reason: ServerMuteReason) {
    if (muted !== this.userMuted) {
      this.setUserMuted(muted);
      this[LocalCameraStreamEventNames.ServerMuted].emit(muted, reason);
    }
  }
}

export const createMicrophoneStream = (constraints?: AudioDeviceConstraints) =>
  wcmeCreateMicrophoneStream(LocalMicrophoneStream, constraints);

export const createCameraStream = (constraints?: VideoDeviceConstraints) =>
  wcmeCreateCameraStream(LocalCameraStream, constraints);

export const createDisplayStream = () => wcmeCreateDisplayStream(LocalDisplayStream);

export const createDisplayStreamWithAudio = () =>
  wcmeCreateDisplayStreamWithAudio(LocalDisplayStream, LocalSystemAudioStream);

export const LocalMicrophoneStream = AddEvents<
  typeof _LocalMicrophoneStream,
  LocalMicrophoneStreamEvents
>(_LocalMicrophoneStream);

export type LocalMicrophoneStream = _LocalMicrophoneStream &
  WithEventsDummyType<LocalMicrophoneStreamEvents>;

export const LocalCameraStream = AddEvents<typeof _LocalCameraStream, LocalCameraStreamEvents>(
  _LocalCameraStream
);

export type LocalCameraStream = _LocalCameraStream & WithEventsDummyType<LocalCameraStreamEvents>;
