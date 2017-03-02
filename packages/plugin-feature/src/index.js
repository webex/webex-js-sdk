/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {registerPlugin} from '@ciscospark/spark-core';
import Feature from './feature';
import config from './config';

registerPlugin(`feature`, Feature, {
  config
});

export {default as default} from './feature';
