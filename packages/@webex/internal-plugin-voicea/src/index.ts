import * as WebexCore from '@webex/webex-core';

import VoiceaChannel from './voicea';
import type {MeetingTranscriptPayload, MeetingHighlightPayload} from './voicea.types';

WebexCore.registerInternalPlugin('voicea', VoiceaChannel, {});

export {default} from './voicea';
export {type MeetingTranscriptPayload};
export {type MeetingHighlightPayload};
export {EVENT_TRIGGERS, TURN_ON_CAPTION_STATUS} from './constants';
