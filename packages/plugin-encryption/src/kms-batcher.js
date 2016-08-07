/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

/* eslint require-jsdoc: [0] */

import {RequestBatcher} from '@ciscospark/spark-core';
import KmsError from './kms-error';

export const TIMEOUT_SYMBOL = Symbol(`TIMEOUT_SYMBOL`);

export default class KMSBatcher extends RequestBatcher {
  processKmsMessageEvent(event) {
    this.logger.info(`kms-batcher: received kms message`);

    return Promise.all(event.encryption.kmsMessages.map((kmsMessage) => new Promise((resolve) => {
      if (process.env.NODE_ENV !== `production`) {
        this.logger.info(`kms-batcher:`, kmsMessage.body);
      }

      try {
        if (kmsMessage.status < 400) {
          // Suppress errors; they're a side effect of receiving late responses
          this.requestDidSucceed(kmsMessage, kmsMessage.body);
        }
        else {
          // Suppress errors; they're a side effect of receiving late responses
          this.requestDidFail(kmsMessage, new KmsError(kmsMessage.body));
        }
      }
      catch (e) {
        // ignore
      }

      resolve();
    })));
  }

  submit(payload) {
    this.logger.info(`kms: batched request length `, payload.kmsMessages.length);
    return this.spark.request({
      method: `POST`,
      service: `encryption`,
      resource: `/kms/messages`,
      body: payload
    });
  }

  generateKey(r) {
    const key = r.requestId || r.body.requestId;
    if (!key) {
      throw new Error(`Could not find requestId on ${r}`);
    }
    return key;
  }

  batchDidReceiveRequest(item, defer) {
    const timeout = item[TIMEOUT_SYMBOL];
    if (!timeout) {
      throw new Error(`timeout is required`);
    }
    const key = this.generateKey(item);

    const timer = setTimeout(() => {
      this.logger.warn(`kms: request timed out; request id: ${key}; timeout: ${timeout}`);
      this.markFailure(item, new Error(`KMS request did not return in a timely manner`));
    }, timeout);

    defer.promise.then(cancelTimer);
    defer.promise.catch(cancelTimer);

    function cancelTimer() {
      clearTimeout(timer);
    }
  }

  batchWillExecute(queue) {
    this.logger.info(`kms-batcher: batchWillExecute()`);
    return this.spark.encryption.kms._getKMSCluster()
      .then((cluster) => ({
        destination: cluster,
        kmsMessages: queue.map((req) => req.wrapped)
      }));
  }

  batchDidSucceed() {
    // noop
  }
}
