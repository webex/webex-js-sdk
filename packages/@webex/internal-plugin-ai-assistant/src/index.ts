import {registerInternalPlugin} from '@webex/webex-core';

import AIAssistant from './ai-assistant';
import config from './config';

registerInternalPlugin('aiassistant', AIAssistant, {config});

export {default} from './ai-assistant';
