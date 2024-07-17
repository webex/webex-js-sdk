import * as WebexCore from '@webex/webex-core';

import VoiceaChannel from './voicea';
import type {MeetingTranscriptPayload} from './voicea.types';

WebexCore.registerInternalPlugin('voicea', VoiceaChannel, {});

export {default} from './voicea';
export {type MeetingTranscriptPayload};
export {EVENT_TRIGGERS, TURN_ON_CAPTION_STATUS} from './constants';
