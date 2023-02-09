import {registerInternalPlugin} from '@webex/webex-core';

import Scheduler, {config, CONSTANTS} from './scheduler';

// Mounts the plugin to `webex.internal.{NAMESPACE}` and begins initialization.
registerInternalPlugin(CONSTANTS.NAMESPACE, Scheduler, config);

export default Scheduler;
