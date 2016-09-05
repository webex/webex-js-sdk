/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {tap} from '@ciscospark/common';
import {Batcher} from '@ciscospark/spark-core';
import KmsError from './kms-error';

// export const TIMEOUT_SYMBOL = `TIMEOUT_SYMBOL`;
export const TIMEOUT_SYMBOL = Symbol(`TIMEOUT_SYMBOL`);


const KmsBatcher = Batcher.extend({
  namespace: `Encryption`,

  processKmsMessageEvent(event) {
    this.logger.info(`kms-batcher: received kms message`);
    return Promise.all(event.encryption.kmsMessages.map((kmsMessage) => new Promise((resolve) => {
      if (process.env.NODE_ENV !== `production`) {
        this.logger.info(`kms-batcher:`, kmsMessage.body);
      }

      resolve(this.acceptItem(kmsMessage));
    })));
  },

  prepareItem(item) {
    return this.getDeferredForRequest(item)
      .then((defer) => {
        const timeout = item[TIMEOUT_SYMBOL];

        if (!timeout) {
          throw new Error(`timeout is required`);
        }

        const timer = setTimeout(() => {
          this.logger.warn(`kms: request timed out; request id: ${item.id}; timeout: ${timeout}`);
          this.handleItemFailure(item);
        }, timeout);

        defer.promise = defer.promise.then(tap(() => clearTimeout(timer)));
        defer.promise = defer.promise.catch((reason) => {
          clearTimeout(timer);
          return Promise.reject(reason);
        });

        return item;
      });
  },

  prepareRequest(queue) {
    return this.spark.encryption.kms._getKMSCluster()
      .then((cluster) => ({
        destination: cluster,
        kmsMessages: queue.map((req) => req.wrapped)
      }));
  },

  submitHttpRequest(payload) {
    this.logger.info(`kms: batched-request-length`, payload.kmsMessages.length);
    return this.spark.request({
      method: `POST`,
      service: `encryption`,
      resource: `/kms/messages`,
      body: payload
    });
  },

  handleHttpSuccess() {
    return Promise.resolve();
  },

  didItemFail(item) {
    return Promise.resolve(item.status >= 400);
  },

  handleItemSuccess(item) {
    return this.getDeferredForResponse(item)
      .then((defer) => {
        defer.resolve(item.body);
      });
  },

  handleItemFailure(item) {
    return this.getDeferredForResponse(item)
      .then((defer) => {
        defer.reject(new KmsError(item.body));
      });
  },

  fingerprintRequest(item) {
    return Promise.resolve(item.requestId);
  },

  fingerprintResponse(item) {
    return Promise.resolve(item.requestId || item.body.requestId);
  }
});

export default KmsBatcher;
