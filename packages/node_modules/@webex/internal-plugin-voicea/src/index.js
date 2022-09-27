import * as WebexCore from '@webex/webex-core';
import VoiceaChannel from '@webex/internal-plugin-voicea/src/voicea';

WebexCore.registerInternalPlugin('voicea', VoiceaChannel, {});

export {default} from '@webex/internal-plugin-voicea/src/voicea';
