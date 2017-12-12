/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import '@ciscospark/internal-plugin-wdm';

import {registerInternalPlugin} from '@ciscospark/spark-core';
import Metrics from './metrics';
import config from './config';

registerInternalPlugin('metrics', Metrics, {
  config
});

export {default} from './metrics';
export {config};
