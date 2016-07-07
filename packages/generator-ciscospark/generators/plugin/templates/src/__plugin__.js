/**!
 *
 * Copyright (c) 2015-<%= (new Date()).getUTCFullYear() %> Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {SparkPlugin} from '@ciscospark/spark-core';

const <%= constructorName %> = SparkPlugin.extend({
  namespace: `<%= constructorName %>`
});

export default <%= constructorName %>;
