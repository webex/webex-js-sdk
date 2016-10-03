/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {registerPlugin} from '@ciscospark/spark-core';
import Flag from './flag';
import config from './config';
import '@ciscospark/plugin-wdm';

registerPlugin(`flag`, Flag, {
  config
});

export {default as default} from './flag';
