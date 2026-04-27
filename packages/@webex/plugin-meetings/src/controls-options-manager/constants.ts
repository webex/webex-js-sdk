import {camelCase} from 'lodash';
import {Control, Setting} from './enums';

const ENABLED = 'enabled';
const CAN_SET = 'canSet';
const CAN_UNSET = 'canUnset';

/**
 * Body keys that represent audio controls. These do not support cross-locus
 * authorization and must be sent directly to the current locus URL.
 */
const AUDIO_CONTROL_BODY_KEYS: ReadonlySet<string> = new Set([
  Control.audio,
  camelCase(Setting.muteOnEntry),
  camelCase(Setting.disallowUnmute),
]);

export {ENABLED, CAN_SET, CAN_UNSET, AUDIO_CONTROL_BODY_KEYS};
