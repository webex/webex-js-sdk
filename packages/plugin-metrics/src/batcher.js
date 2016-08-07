/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import {defaults} from 'lodash';
import {Defer} from '@ciscospark/common';
import {RequestBatcher} from '@ciscospark/spark-core';
import uuid from 'uuid';

export const PAYLOAD_KEY_SYMBOL = Symbol(`PAYLOAD_KEY_SYMBOL`);

export default class MetricsRequestBatcher extends RequestBatcher {
  submit(payload) {
    return this.request({
      method: `POST`,
      service: `metrics`,
      resource: `metrics`,
      body: {
        metrics: payload
      }
    });
  }

  generateKey(payload) {
    return payload[PAYLOAD_KEY_SYMBOL];
  }

  batchWillReceiveRequest(payload) {
    defaults(payload, {
      appType: this.config.appType,
      env: process.env.NODE_ENV || `development`,
      version: this.spark.version,
      time: Date.now()
    });

    // Note: lodash.defaults doesn't supoprt symbols at this time so we need to
    // set it manually.
    payload[PAYLOAD_KEY_SYMBOL] = payload[PAYLOAD_KEY_SYMBOL] || uuid.v4();
    return payload;
  }

  batchWillExecute(queue) {
    const now = Date.now();
    queue.forEach((item) => {
      item.postTime = now;
    });
    return queue;
  }

  requestWillFail(item, reason) {
    if (reason.statusCode === 0) {
      const defer = new Defer();
      this.markSuccess(item, defer.promise);

      setTimeout(() => {
        defer.resolve(this.enqueue(item));
      }, this.config.retryDelay);

      return Promise.resolve();
    }
    return Promise.reject(reason);
  }
}
