/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */
import '@webex/internal-plugin-mercury';

import {registerInternalPlugin} from '@webex/webex-core';

import Feature from './feature';
import config from './config';

registerInternalPlugin('feature', Feature, {
  config
});

export {default} from './feature';
