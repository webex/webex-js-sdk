/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {registerInternalPlugin} from '@webex/webex-core';

import Metrics from './metrics';
import config from './config';

registerInternalPlugin('metrics', Metrics, {
  config,
});

export {default, getOSNameInternal} from './metrics';
export {config};
