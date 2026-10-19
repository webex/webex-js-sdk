import {registerInternalPlugin} from '@webex/webex-core';

import '@webex/internal-plugin-conversation';
import '@webex/internal-plugin-device';
import '@webex/internal-plugin-encryption';
import '@webex/internal-plugin-mercury';
import UserApps from './userApps';
import config from './config';

registerInternalPlugin('userApps', UserApps, {config});

export * from './constants';
export * from './errors';
export * from './types';
// eslint-disable-next-line no-restricted-exports
export {default} from './userApps';
