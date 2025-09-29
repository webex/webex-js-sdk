/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {Batcher, WebexPlugin} from '@webex/webex-core';

/**
 * AbstractUserUUIDRequestBatcher class for handling user UUID request batching
 * @class
 * @extends Batcher
 */
class AbstractUserUUIDRequestBatcher extends Batcher {
  namespace = 'User';

  constructor(attrs, options) {
    super(attrs, options);
  }

  /**
   * Prepare an individual item for batching
   * @param {string} item - The item to prepare
   * @returns {Promise<Object>} Promise resolving to the prepared item
   */
  prepareItem(item) {
    return Promise.resolve({email: item});
  }

  /**
   * Handle successful HTTP response
   * @param {HttpResponseObject} res - The HTTP response object
   * @returns {Promise} Promise resolving when all items are processed
   */
  handleHttpSuccess(res) {
    return Promise.all(
      Object.keys(res.body).map((email) => {
        if (res.body[email] && res.body[email].id) {
          return this.handleItemSuccess(email, res.body[email]);
        }

        return this.handleItemFailure(email, res.body[email]);
      })
    );
  }

  /**
   * Handle item failure
   * @param {string} email - The email that failed
   * @param {any} response - The response object
   * @returns {Promise} Promise resolving when failure is handled
   */
  handleItemFailure(email, response) {
    return this.getDeferredForResponse(email).then((defer) => {
      defer.reject(response);
    });
  }

  /**
   * Handle item success
   * @param {string} email - The email that succeeded
   * @param {Object} response - The response object
   * @returns {Promise} Promise resolving when success is handled
   */
  handleItemSuccess(email, response) {
    return this.getDeferredForResponse(email).then((defer) => {
      defer.resolve(response);
    });
  }

  /**
   * Create fingerprint for request
   * @param {string} email - The email to fingerprint
   * @returns {Promise<string>} Promise resolving to the fingerprint
   */
  fingerprintRequest(email) {
    return Promise.resolve(email.email || email);
  }

  /**
   * Create fingerprint for response
   * @param {string} email - The email to fingerprint
   * @returns {Promise<string>} Promise resolving to the fingerprint
   */
  fingerprintResponse(email) {
    return Promise.resolve(email);
  }
}

/**
 * FakeUserUUIDRequestBatcher class for handling fake user UUID requests
 * @class
 * @extends AbstractUserUUIDRequestBatcher
 */
class FakeUserUUIDRequestBatcher extends AbstractUserUUIDRequestBatcher {
  /**
   * Submit the HTTP request
   * @param {Object} payload - The payload to submit
   * @returns {Promise<HttpResponseObject>} Promise resolving to the HTTP response
   */
  submitHttpRequest(payload) {
    return this.webex.request({
      method: 'POST',
      service: 'conversation',
      resource: '/users',
      body: payload,
    });
  }
}

/**
 * RealUserUUIDRequestBatcher class for handling real user UUID requests
 * @class
 * @extends AbstractUserUUIDRequestBatcher
 */
class RealUserUUIDRequestBatcher extends AbstractUserUUIDRequestBatcher {
  /**
   * Submit the HTTP request
   * @param {Object} payload - The payload to submit
   * @returns {Promise<HttpResponseObject>} Promise resolving to the HTTP response
   */
  submitHttpRequest(payload) {
    return this.webex.request({
      method: 'POST',
      service: 'conversation',
      resource: '/users',
      body: payload,
      qs: {
        shouldCreateUsers: true,
      },
    });
  }
}

/**
 * UserUUIDBatcher class for managing user UUID batching
 * @class
 * @extends WebexPlugin
 */
class UserUUIDBatcher extends WebexPlugin {
  children = {
    faker: FakeUserUUIDRequestBatcher,
    creator: RealUserUUIDRequestBatcher,
  };

  /**
   * Process a request
   * @param {Object} payload - The payload containing email and create flag
   * @returns {Promise<Object>} Promise resolving to the response
   */
  request(payload) {
    return payload.create ? this.creator.request(payload.email) : this.faker.request(payload.email);
  }
}

export default UserUUIDBatcher;
