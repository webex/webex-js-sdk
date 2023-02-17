import {DISPLAY_HINTS} from '../constants';

const canSetMuteOnEntry = (displayHints: Array<string>): boolean =>
  displayHints.includes(DISPLAY_HINTS.ENABLE_MUTE_ON_ENTRY);

const canSetDisallowUnmute = (displayHints: Array<string>): boolean =>
  displayHints.includes(DISPLAY_HINTS.ENABLE_HARD_MUTE);

const canUnsetMuteOnEntry = (displayHints: Array<string>): boolean =>
  displayHints.includes(DISPLAY_HINTS.DISABLE_MUTE_ON_ENTRY);

const canUnsetDisallowUnmute = (displayHints: Array<string>): boolean =>
  displayHints.includes(DISPLAY_HINTS.DISABLE_HARD_MUTE);

const canSetMuted = (displayHints: Array<string>): boolean =>
  displayHints.includes(DISPLAY_HINTS.MUTE_ALL);

const canUnsetMuted = (displayHints: Array<string>): boolean =>
  displayHints.includes(DISPLAY_HINTS.UNMUTE_ALL);

export default {
  canSetMuteOnEntry,
  canSetDisallowUnmute,
  canSetMuted,
  canUnsetMuteOnEntry,
  canUnsetDisallowUnmute,
  canUnsetMuted,
};
