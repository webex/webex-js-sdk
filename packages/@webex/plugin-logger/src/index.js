/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {registerPlugin} from '@webex/webex-core';

import Logger from './logger';
import config from './config';

registerPlugin('logger', Logger, {
  config,
  replace: true,
});

export {default, levels} from './logger';
export {
  LOG_ATTRIBUTE_KEYS,
  LOG_RECORD_SCHEMA_NAME,
  LOG_RECORD_SCHEMA_VERSION,
  LOG_SOURCES,
} from './log-record';
