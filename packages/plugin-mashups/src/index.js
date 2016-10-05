/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */
import '@ciscospark/plugin-wdm';
import '@ciscospark/plugin-conversation';

import {registerPlugin} from '@ciscospark/spark-core';
import Mashups from './mashups';
import config from './config';

registerPlugin(`mashups`, Mashups, {
  config
});

export {default as default} from './mashups';
