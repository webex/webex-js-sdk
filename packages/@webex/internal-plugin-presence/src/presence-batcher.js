/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {Batcher} from '@webex/webex-core';

/**
 * PresenceBatcher class for handling presence request batching
 * @class
 * @extends Batcher
 */
class PresenceBatcher extends Batcher {
  namespace = 'Presence';

  constructor(attrs, options) {
    super(attrs, options);
  }

  /**
   * Handle successful HTTP response
   * @param {HttpResponseObject} res - The HTTP response object
   * @returns {Promise} Promise resolving when all items are processed
   */
  handleHttpSuccess(res) {
    return Promise.all(
      res.body.statusList.map((presenceResponse) =>
        this.handleItemSuccess(presenceResponse.subject, presenceResponse)
      )
    );
  }

  /**
   * Handle item failure
   * @param {string} item - The item that failed
   * @param {Object} response - The response object
   * @returns {Promise} Promise resolving when failure is handled
   */
  handleItemFailure(item, response) {
    return this.getDeferredForResponse(item).then((defer) => {
      defer.reject(response);
    });
  }

  /**
   * Handle item success
   * @param {string} item - The item that succeeded
   * @param {Object} response - The response object
   * @returns {Promise} Promise resolving when success is handled
   */
  handleItemSuccess(item, response) {
    return this.getDeferredForResponse(item).then((defer) => {
      defer.resolve(response);
    });
  }

  /**
   * Create fingerprint for request
   * @param {string} id - The ID to fingerprint
   * @returns {Promise<string>} Promise resolving to the fingerprint
   */
  fingerprintRequest(id) {
    return Promise.resolve(id);
  }

  /**
   * Create fingerprint for response
   * @param {string} id - The ID to fingerprint
   * @returns {Promise<string>} Promise resolving to the fingerprint
   */
  fingerprintResponse(id) {
    return Promise.resolve(id);
  }

  /**
   * Prepare the request from the queue
   * @param {Array} ids - Array of IDs to prepare
   * @returns {Promise<Array>} Promise resolving to the prepared request
   */
  prepareRequest(ids) {
    return Promise.resolve(ids);
  }

  /**
   * Submit the HTTP request
   * @param {Object} subjects - The subjects to submit
   * @returns {Promise<HttpResponseObject>} Promise resolving to the HTTP response
   */
  submitHttpRequest(subjects) {
    return this.webex.request({
      method: 'POST',
      api: 'apheleia',
      resource: 'compositions',
      body: {subjects},
    });
  }
}

export default PresenceBatcher;
