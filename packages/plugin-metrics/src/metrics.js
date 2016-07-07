/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {SparkPlugin} from '@ciscospark/spark-core';
import {defaults} from 'lodash';

const Metrics = SparkPlugin.extend({
  namespace: `Metrics`,

  submit(key, value) {
    value = value || {};
    defaults(value, {
      appType: this.config.appType,
      env: process.env.NODE_ENV || `development`,
      version: this.spark.version,
      time: Date.now(),
      postTime: Date.now()
    });

    return this.request({
      method: `POST`,
      service: `metrics`,
      resource: `metrics`,
      body: {
        metrics: [Object.assign({key}, value)]
      }
    });
  }
});

export default Metrics;
