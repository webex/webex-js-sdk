/* eslint-env browser */
import {registerPlugin} from '@webex/webex-core';

import Meetings from './meetings';
import config from './config';
import {LocusRetryStatusInterceptor} from './interceptors';
import CaptchaError from './common/errors/captcha-error';
import IntentToJoinError from './common/errors/intent-to-join';
import PasswordError from './common/errors/password-error';
import PermissionError from './common/errors/permission';
import {
  ReclaimHostEmptyWrongKeyError,
  ReclaimHostIsHostAlreadyError,
  ReclaimHostNotAllowedError,
  ReclaimHostNotSupportedError,
} from './common/errors/reclaim-host-role-errors';
import Meeting from './meeting';
import MeetingInfoUtil from './meeting-info/utilv2';
import JoinMeetingError from './common/errors/join-meeting';

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
  RemoteStreamEventNames,
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
} from '@webex/media-helpers';

export default Meetings;

export * as CONSTANTS from './constants';
export * as REACTIONS from './reactions/reactions';
export * as sdkAnnotationTypes from './annotation/annotation.types';
export * as MeetingInfoV2 from './meeting-info/meeting-info-v2';
export {type Reaction} from './reactions/reactions.type';

export {
  CaptchaError,
  IntentToJoinError,
  JoinMeetingError,
  PasswordError,
  PermissionError,
  ReclaimHostIsHostAlreadyError,
  ReclaimHostNotAllowedError,
  ReclaimHostNotSupportedError,
  ReclaimHostEmptyWrongKeyError,
  Meeting,
  MeetingInfoUtil,
};

export {RemoteMedia} from './multistream/remoteMedia';

export {default as TriggerProxy} from './common/events/trigger-proxy';
