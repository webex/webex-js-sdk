/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {safeSetTimeout} from '@webex/common-timers';
import {Batcher} from '@webex/webex-core';

import {KmsError, KmsTimeoutError, handleKmsKeyRevokedEncryptionFailure} from './kms-errors';

export const TIMEOUT_SYMBOL = Symbol('TIMEOUT_SYMBOL');

/**
 * KmsBatcher class for handling KMS message batching and submission
 * @class
 * @extends Batcher
 */
class KmsBatcher extends Batcher {
  namespace = 'Encryption';

  constructor(attrs, options) {
    super(attrs, options);
  }

  /**
   * Accepts a kmsMessage event and passes its contents to acceptItem
   * @param {Object} event - The KMS message event
   * @returns {Promise<void>} Promise resolving when all messages are processed
   */
  processKmsMessageEvent(event) {
    this.logger.info('kms-batcher: received kms message');

    return Promise.all(
      event.encryption.kmsMessages.map(
        (kmsMessage) =>
          new Promise((resolve) => {
            /* istanbul ignore else */
            if (process.env.NODE_ENV !== 'production') {
              this.logger.info('kms-batcher:', kmsMessage.body);
            }

            resolve(this.acceptItem(kmsMessage));
          })
      )
    ).then(() => {});
  }

  /**
   * Attaches a timeout to the given KMS message
   * @param {Object} item - The KMS message item
   * @returns {Promise<Object>} Promise resolving to the prepared item
   */
  prepareItem(item) {
    return this.getDeferredForRequest(item).then((defer) => {
      const timeout = item[TIMEOUT_SYMBOL];

      /* istanbul ignore if */
      if (!timeout) {
        throw new Error('timeout is required');
      }

      const timer = safeSetTimeout(() => {
        this.logger.warn(
          `kms: request timed out; request id: ${item.requestId}; timeout: ${timeout}`
        );
        this.handleItemFailure(
          item,
          new KmsTimeoutError({
            timeout,
            request: item,
          })
        );
      }, timeout);

      // Reminder: reassign `promise` is not a viable means of inserting into
      // the Promise chain
      defer.promise.then(() => clearTimeout(timer));
      defer.promise.catch(() => clearTimeout(timer));

      return item;
    });
  }

  /**
   * Attaches the final bits of cluster info to the payload
   * @param {Array} queue - The queue of items to prepare
   * @returns {Promise<Object>} Promise resolving to the prepared request
   */
  prepareRequest(queue) {
    return this.webex.internal.encryption.kms._getKMSCluster().then((cluster) => ({
      destination: cluster,
      kmsMessages: queue.map((req) => req.wrapped),
    }));
  }

  /**
   * Submit the HTTP request to the KMS service
   * @param {Object} payload - The payload to submit
   * @returns {Promise<any>} Promise resolving to the HTTP response
   */
  submitHttpRequest(payload) {
    this.logger.info('kms: batched-request-length', payload.kmsMessages.length);

    return this.webex.request({
      method: 'POST',
      service: 'encryption',
      resource: '/kms/messages',
      body: payload,
    });
  }

  /**
   * Does nothing; the http response doesn't carry our response data
   * @returns {Promise<void>} Promise resolving immediately
   */
  handleHttpSuccess() {
    return Promise.resolve();
  }

  /**
   * Check if the item failed
   * @param {Object} item - The item to check
   * @returns {Promise<boolean>} Promise resolving to failure status
   */
  didItemFail(item) {
    return Promise.resolve(item.status >= 400);
  }

  /**
   * Handle item success
   * @param {Object} item - The item that succeeded
   * @returns {Promise<void>} Promise resolving when success is handled
   */
  handleItemSuccess(item) {
    return this.getDeferredForResponse(item).then((defer) => {
      defer.resolve(item.body);
    });
  }

  /**
   * Handle item failure
   * @param {Object} item - The item that failed
   * @param {KmsError} [reason] - The failure reason
   * @returns {Promise<void>} Promise resolving when failure is handled
   */
  handleItemFailure(item, reason) {
    handleKmsKeyRevokedEncryptionFailure(item, this.webex);

    return this.getDeferredForResponse(item).then((defer) => {
      defer.reject(reason || new KmsError(item.body));
    });
  }

  /**
   * Create fingerprint for request
   * @param {Object} item - The item to fingerprint
   * @returns {Promise<string>} Promise resolving to the fingerprint
   */
  fingerprintRequest(item) {
    return Promise.resolve(item.requestId);
  }

  /**
   * Create fingerprint for response
   * @param {Object} item - The item to fingerprint
   * @returns {Promise<string>} Promise resolving to the fingerprint
   */
  fingerprintResponse(item) {
    return Promise.resolve(item.requestId);
  }
}

export default KmsBatcher;
