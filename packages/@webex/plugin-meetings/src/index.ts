/* eslint-env browser */
import {registerPlugin} from '@webex/webex-core';

import Meetings from './meetings';
import config from './config';
import {LocusRetryStatusInterceptor} from './interceptors';

registerPlugin('meetings', Meetings, {
  config,
  interceptors: {
    LocusRetryStatusInterceptor: LocusRetryStatusInterceptor.create,
  },
});

export {
  getDevices,
  LocalStream,
  LocalDisplayStream,
  LocalSystemAudioStream,
  LocalStreamEventNames,
  StreamEventNames,
  type ServerMuteReason,
  LocalMicrophoneStreamEventNames,
  LocalCameraStreamEventNames,
  LocalMicrophoneStream,
  LocalCameraStream,
  createMicrophoneStream,
  createCameraStream,
  createDisplayStream,
  createDisplayStreamWithAudio,
  FacingMode,
  DisplaySurface,
  PresetCameraConstraints,
  type VideoContentHint,
  Errors,
  WcmeError,
  WcmeErrorType,
} from '@webex/media-helpers';

export default Meetings;

export * as CONSTANTS from './constants';
export * as REACTIONS from './reactions/reactions';

export {RemoteMedia} from './multistream/remoteMedia';

export {default as TriggerProxy} from './common/events/trigger-proxy';
