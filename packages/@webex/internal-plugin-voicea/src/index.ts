import * as WebexCore from '@webex/webex-core';

import Voicea from './voicea-plugin';
import {VoiceaChannel} from './voicea';
import type {MeetingTranscriptPayload, SpeakerNameUpdatePayload} from './voicea.types';

WebexCore.registerInternalPlugin('voicea', Voicea, {});

export {Voicea as VoiceaPlugin, VoiceaChannel};
export default Voicea;
export {type MeetingTranscriptPayload, type SpeakerNameUpdatePayload};
export {EVENT_TRIGGERS, TURN_ON_CAPTION_STATUS} from './constants';
