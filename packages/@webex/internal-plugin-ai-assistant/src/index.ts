import {registerInternalPlugin} from '@webex/webex-core';

import AIAssistant from './ai-assistant';
import config from './config';

// Test comment for BYODS detection
registerInternalPlugin('aiassistant', AIAssistant, {config});

export {default} from './ai-assistant';
