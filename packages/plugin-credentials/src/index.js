/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {registerPlugin} from '@ciscospark/spark-core';
import Credentials from './credentials';
import config from './config';

registerPlugin(`credentials`, Credentials, {
  config
});

export {default as default} from './credentials';
