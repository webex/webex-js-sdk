/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {SparkPlugin} from '@ciscospark/spark-core';
import Batcher from './batcher';
import ClientMetricsBatcher from './client-metrics-batcher';
import {deprecated} from 'core-decorators';

const Metrics = SparkPlugin.extend({
  children: {
    batcher: Batcher,
    clientMetricsBatcher: ClientMetricsBatcher
  },

  namespace: `Metrics`,

  @deprecated(`Metrics#sendUnstructured() is deprecated; please use Metrics#submit()`)
  sendUnstructured(key, value) {
    return this.submit(key, value);
  },

  submit(key, value) {
    return this.batcher.request(Object.assign({key}, value));
  },

  submitClientMetrics(eventName, props) {
    const payload = {metricName: eventName};
    if (props.tags) {
      payload.tags = props.tags;
    }
    if (props.fields) {
      payload.fields = props.fields;
    }
    return this.clientMetricsBatcher.request(payload);
  }
});

export default Metrics;
