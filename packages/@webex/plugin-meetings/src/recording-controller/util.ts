import {DISPLAY_HINTS} from '../constants';
import RecordingAction from './enums';

const canUserStart = (displayHints: Array<string>): boolean =>
  displayHints.includes(DISPLAY_HINTS.RECORDING_CONTROL_START);

const canUserPause = (displayHints: Array<string>): boolean =>
  displayHints.includes(DISPLAY_HINTS.RECORDING_CONTROL_PAUSE);

const canUserResume = (displayHints: Array<string>): boolean =>
  displayHints.includes(DISPLAY_HINTS.RECORDING_CONTROL_RESUME);

const canUserStop = (displayHints: Array<string>): boolean =>
  displayHints.includes(DISPLAY_HINTS.RECORDING_CONTROL_STOP);

const extractLocusId = (url: string) => {
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
