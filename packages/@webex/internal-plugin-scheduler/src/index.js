// Import all plugins used within this plugin here, as they are singletons
// and must be mounted prior to any other mounting logic within this plugin.
import '@webex/internal-plugin-encryption';

import {registerInternalPlugin} from '@webex/webex-core';

import Scheduler, {config, CONSTANTS} from './scheduler';
import payloadTransformer from './payloadTransformer';

// Mounts the plugin to `webex.internal.{NAMESPACE}` and begins initialization.
registerInternalPlugin(CONSTANTS.NAMESPACE, Scheduler, {
  payloadTransformer,
  config,
});

export default Scheduler;
