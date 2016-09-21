/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {registerPlugin} from '@ciscospark/spark-core';
import Support from './support';
import config from './config';

registerPlugin(`support`, Support, {
  config
});

export {default as default} from './support';
