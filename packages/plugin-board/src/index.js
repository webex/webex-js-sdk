/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import '@ciscospark/plugin-mercury';
import '@ciscospark/plugin-encryption';
import '@ciscospark/plugin-conversation';

import {registerPlugin} from '@ciscospark/spark-core';
import Board from './board';
import config from './config';

registerPlugin(`board`, Board, {
  config
});

export {default as default} from './board';
export {config as config};
