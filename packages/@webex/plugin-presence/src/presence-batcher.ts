/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {Batcher} from '@webex/webex-core';
import {IPresenceBatcher} from './interface';

/**
 * PresenceBatcher class for handling presence batching and submission
 * @class
 * @extends Batcher
 * @implements {IPresenceBatcher}
 */
class PresenceBatcher extends Batcher implements IPresenceBatcher {
  webex: any;
  namespace = 'Presence';
  maxSize: number;
  maxWait: number;
  getDeferredForResponse: (
    item: string
  ) => Promise<{resolve: (value: any) => void; reject: (reason?: any) => void}>;

  /**
   * @see {@link Batcher#constructor}
   * @param {Object} options
   */
  constructor(options: any) {
    super(options);
    this.maxSize = 100;
    this.maxWait = 100;
  }

  /**
   * Handle successful HTTP response
   * @param {any} res - The HTTP response object
   * @returns {Promise<void>} Promise resolving when all items are processed
   */
  handleHttpSuccess(res: any): Promise<void> {
    return Promise.all(
      res.body.statusList.map((presenceResponse: any) =>
        this.handleItemSuccess(presenceResponse.subject, presenceResponse)
      )
    ).then(() => {});
  }

  /**
   * Handle item failure
   * @param {string} item - The item that failed
   * @param {any} response - The response object
   * @returns {Promise<void>} Promise resolving when failure is handled
   */
  handleItemFailure(item: string, response?: any): Promise<void> {
    return this.getDeferredForResponse(item).then((defer) => {
      defer.reject(response);
    });
  }

  /**
   * Handle item success
   * @param {string} item - The item that succeeded
   * @param {any} response - The response object
   * @returns {Promise<void>} Promise resolving when success is handled
   */
  handleItemSuccess(item: string, response: any): Promise<void> {
    return this.getDeferredForResponse(item).then((defer) => {
      defer.resolve(response);
    });
  }

  /**
   * Create fingerprint for request
   * @param {string} id - The ID to fingerprint
   * @returns {Promise<string>} Promise resolving to the fingerprint
   */
  fingerprintRequest(id: string): Promise<string> {
    return Promise.resolve(id);
  }

  /**
   * Create fingerprint for response
   * @param {string} id - The ID to fingerprint
   * @returns {Promise<string>} Promise resolving to the fingerprint
   */
  fingerprintResponse(id: string): Promise<string> {
    return Promise.resolve(id);
  }

  /**
   * Prepare the request from the queue
   * @param {string[]} ids - Array of IDs to prepare
   * @returns {Promise<string[]>} Promise resolving to the prepared request
   */
  prepareRequest(ids: string[]): Promise<string[]> {
    return Promise.resolve(ids);
  }

  /**
   * Submit the HTTP request
   * @param {any} subjects - The subjects to submit
   * @returns {Promise<any>} Promise resolving to the HTTP response
   */
  submitHttpRequest(subjects: any): Promise<any> {
    return this.webex.request({
      method: 'POST',
      api: 'apheleia',
      resource: 'compositions',
      body: {subjects},
    });
  }
}

export default PresenceBatcher;
