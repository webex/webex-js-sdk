/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {registerPlugin} from '@ciscospark/spark-core';
import Logger from './logger';
import config from './config';

registerPlugin(`logger`, Logger, {
  config
});

export {
  default as default,
  levels
} from './logger';
