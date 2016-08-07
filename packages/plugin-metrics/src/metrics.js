/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {SparkPlugin} from '@ciscospark/spark-core';
import MetricsBatcher from './batcher';

const Metrics = SparkPlugin.extend({
  namespace: `Metrics`,

  children: {
    batch: MetricsBatcher
  },

  submit(key, value) {
    if (!key) {
      throw new Error(`\`key\` is required`);
    }

    if (!value) {
      throw new Error(`\`value\` is required`);
    }

    return this.batch.enqueue({key, value});
  }
});

export default Metrics;
