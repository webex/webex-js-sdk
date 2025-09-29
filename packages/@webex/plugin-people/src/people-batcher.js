/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {Batcher} from '@webex/webex-core';

/**
 * PersonUUIDRequestBatcher class for handling person UUID request batching
 * @class
 * @extends Batcher
 */
class PersonUUIDRequestBatcher extends Batcher {
  namespace = 'People';

  constructor(attrs, options) {
    super(attrs, options);
  }

  /**
   * Handle successful HTTP response
   * @param {any} res - The HTTP response object
   * @returns {Promise<void>} Promise resolving when all items are processed
   */
  handleHttpSuccess(res) {
    const promises = res.body.items.map((personResponse) =>
      this.handleItemSuccess(personResponse.id, personResponse)
    );

    if (res.body.notFoundIds) {
      promises.concat(res.body.notFoundIds.map((id) => this.handleItemFailure(id)));
    }

    return Promise.all(promises).then(() => {});
  }

  /**
   * Handle item failure
   * @param {string} id - The ID that failed
   * @returns {Promise<void>} Promise resolving when failure is handled
   */
  handleItemFailure(id) {
    return this.getDeferredForResponse(id).then((defer) => {
      defer.reject(id);
    });
  }

  /**
   * Handle item success
   * @param {string} email - The email that succeeded
   * @param {any} response - The response object
   * @returns {Promise<void>} Promise resolving when success is handled
   */
  handleItemSuccess(email, response) {
    return this.getDeferredForResponse(email).then((defer) => {
      defer.resolve(response);
    });
  }

  /**
   * Create fingerprint for request
   * @param {string} uuidOrHydraId - The UUID or Hydra ID to fingerprint
   * @returns {Promise<string>} Promise resolving to the fingerprint
   */
  fingerprintRequest(uuidOrHydraId) {
    const hydraId = this.webex.people.inferPersonIdFromUuid(uuidOrHydraId);

    return Promise.resolve(hydraId);
  }

  /**
   * Create fingerprint for response
   * @param {string} hydraId - The Hydra ID to fingerprint
   * @returns {Promise<string>} Promise resolving to the fingerprint
   */
  fingerprintResponse(hydraId) {
    return Promise.resolve(hydraId);
  }

  /**
   * Prepare the request from the queue
   * @param {string[]} ids - Array of IDs to prepare
   * @returns {Promise<string>} Promise resolving to the prepared request
   */
  prepareRequest(ids) {
    return Promise.resolve(ids.join());
  }

  /**
   * Submit the HTTP request
   * @param {string} ids - The IDs to submit
   * @returns {Promise<any>} Promise resolving to the HTTP response
   */
  submitHttpRequest(ids) {
    return this.webex.request({
      service: 'hydra',
      resource: `people/?id=${ids}&showAllTypes=${this.config.showAllTypes}`,
    });
  }
}

export default PersonUUIDRequestBatcher;
