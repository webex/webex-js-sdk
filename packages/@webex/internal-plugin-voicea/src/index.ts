import * as WebexCore from '@webex/webex-core';

import VoiceaChannel from './voicea';

WebexCore.registerInternalPlugin('voicea', VoiceaChannel, {});

export {default} from './voicea';
export {EVENT_TRIGGERS, TURN_ON_CAPTION_STATUS} from './constants';
