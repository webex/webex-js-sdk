/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {SparkPlugin} from '@ciscospark/spark-core';
import {filterScope} from './scope';

export const apiScope = filterScope(`spark:kms`, process.env.CISCOSPARK_SCOPE);

const Credentials = SparkPlugin.extend({
  namespace: `Credentials`
});

export default Credentials;
