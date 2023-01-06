/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {registerPlugin} from '@webex/webex-core';

import People from './people';
import config from './config';

registerPlugin('people', People, {
  config,
});

export {default} from './people';
