import {registerPlugin} from '@webex/webex-core';

import config from './config';
import ContactCenter from './cc';

export {TASK_EVENTS} from './services/task/types';
export {AGENT_EVENTS} from './services/agent/types';

registerPlugin('cc', ContactCenter, {
  config,
});

export default ContactCenter;
