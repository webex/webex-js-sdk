/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import '@ciscospark/plugin-wdm';

import {registerPlugin} from '@ciscospark/spark-core';
import Metrics from './metrics';
import config from './config';

registerPlugin(`metrics`, Metrics, {
  config
});

export {default as default} from './metrics';
export {config as config};
