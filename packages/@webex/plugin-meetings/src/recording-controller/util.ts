import {DISPLAY_HINTS, SELF_POLICY} from '../constants';
import RecordingAction from './enums';
import MeetingUtil from '../meeting/util';

const canUserStart = (
  displayHints: Array<string> | undefined,
  userPolicies: Record<SELF_POLICY, boolean> | undefined
): boolean =>
  displayHints?.includes(DISPLAY_HINTS.RECORDING_CONTROL_START)
    ? MeetingUtil.selfSupportsFeature(SELF_POLICY.SUPPORT_NETWORK_BASED_RECORD, userPolicies)
    : false;

const canUserPause = (
  displayHints: Array<string> | undefined,
  userPolicies: Record<SELF_POLICY, boolean> | undefined
): boolean =>
  displayHints?.includes(DISPLAY_HINTS.RECORDING_CONTROL_PAUSE)
    ? MeetingUtil.selfSupportsFeature(SELF_POLICY.SUPPORT_NETWORK_BASED_RECORD, userPolicies)
    : false;

const canUserResume = (
  displayHints: Array<string> | undefined,
  userPolicies: Record<SELF_POLICY, boolean> | undefined
): boolean =>
  displayHints?.includes(DISPLAY_HINTS.RECORDING_CONTROL_RESUME)
    ? MeetingUtil.selfSupportsFeature(SELF_POLICY.SUPPORT_NETWORK_BASED_RECORD, userPolicies)
    : false;

const canUserStop = (
  displayHints: Array<string> | undefined,
  userPolicies: Record<SELF_POLICY, boolean> | undefined
): boolean =>
  displayHints?.includes(DISPLAY_HINTS.RECORDING_CONTROL_STOP)
    ? MeetingUtil.selfSupportsFeature(SELF_POLICY.SUPPORT_NETWORK_BASED_RECORD, userPolicies)
    : false;

const extractLocusId = (url: string | undefined) => {
  return url?.split('/').pop();
};

const deriveRecordingStates = (action: RecordingAction): {recording: boolean; paused: boolean} => {
  let recording;
  let paused;

  switch (action) {
    case RecordingAction.Start:
      recording = true;
      paused = false;
      break;
    case RecordingAction.Stop:
      recording = false;
      paused = false;
      break;
    case RecordingAction.Resume:
      recording = true;
      paused = false;
      break;
    case RecordingAction.Pause:
      recording = true;
      paused = true;
      break;
    default:
      throw new Error(`Recording state cannot be derived from invalid action: ${action}`);
  }

  return {
    recording,
    paused,
  };
};

export default {
  canUserStart,
  canUserPause,
  canUserResume,
  canUserStop,
  deriveRecordingStates,
  extractLocusId,
};
