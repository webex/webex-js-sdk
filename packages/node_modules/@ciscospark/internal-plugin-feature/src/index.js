/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {registerInternalPlugin} from '@ciscospark/spark-core';
import Feature from './feature';
import config from './config';

registerInternalPlugin('feature', Feature, {
  config
});

export {default} from './feature';
