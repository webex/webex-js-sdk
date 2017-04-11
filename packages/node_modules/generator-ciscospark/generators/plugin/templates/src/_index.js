/**!
 *
 * Copyright (c) 2015-<%= (new Date()).getUTCFullYear() %> Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {registerPlugin} from '@ciscospark/spark-core';
import <%= constructorName %> from './<%= pluginFileBaseName %>';
import config from './config';

registerPlugin(`<%= pluginName %>`, <%= constructorName %>, {
  config
});

export {default as default} from './<%= pluginFileBaseName %>';
