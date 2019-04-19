/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {registerPlugin} from '@ciscospark/spark-core';
import People from './people';
import config from './config';

registerPlugin('people', People, {
  config
});

export {default} from './people';
