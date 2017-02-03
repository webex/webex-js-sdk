/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {registerPlugin} from '@ciscospark/spark-core';
import User from './user';
import config from './config';

// uses this.spark.credentials.supertoken so plugin-credentials is needed
import '@ciscospark/plugin-credentials';
import '@ciscospark/plugin-wdm';

registerPlugin(`user`, User, {
  config
});

export {default as default} from './user';
