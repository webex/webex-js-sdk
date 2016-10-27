/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {registerPlugin} from '@ciscospark/spark-core';
import Avatar from './avatar';
import config from './config';

registerPlugin(`avatar`, Avatar, {
  config
});

export {default as default} from './avatar';
