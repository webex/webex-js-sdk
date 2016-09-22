/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {registerPlugin} from '@ciscospark/spark-core';
import Team from './team';
import config from './config';

import '@ciscospark/plugin-conversation';
import '@ciscospark/plugin-user';
import '@ciscospark/plugin-encryption';

import './encrypter';
import './decrypter';
import './normalizer';

registerPlugin(`team`, Team, {
  config
});

export {default as default} from './team';
