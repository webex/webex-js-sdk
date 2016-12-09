/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import '@ciscospark/plugin-avatar';
import '@ciscospark/plugin-board';
import '@ciscospark/plugin-conversation';
import '@ciscospark/plugin-credentials';
import '@ciscospark/plugin-encryption';
import '@ciscospark/plugin-feature';
import '@ciscospark/plugin-flag';
import '@ciscospark/plugin-logger';
import '@ciscospark/plugin-mashups';
import '@ciscospark/plugin-mercury';
import '@ciscospark/plugin-metrics';
import '@ciscospark/plugin-search';
import '@ciscospark/plugin-support';
import '@ciscospark/plugin-team';
import '@ciscospark/plugin-user';
import '@ciscospark/plugin-wdm';
import config from './config';
import SparkCore from '@ciscospark/spark-core';
import {merge} from 'lodash';

/**
 * @param {Object} attrs
 * @param {Object} attrs.config
 * @returns {Spark}
 */
export default function CiscoSpark(attrs) {
  attrs = attrs || {};
  attrs.config = merge(config, attrs.config);
  return new SparkCore(attrs);
}
