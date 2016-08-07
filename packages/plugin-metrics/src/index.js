/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {registerPlugin} from '@ciscospark/spark-core';
import Metrics from './metrics';
import config from './config';

registerPlugin(`metrics`, Metrics, {
  config
});

export {default as default} from './metrics';
export {default as AutoInstrumentInterceptor} from './interceptor';
export {PAYLOAD_KEY_SYMBOL, default as MetricsBatcher} from './batcher';
