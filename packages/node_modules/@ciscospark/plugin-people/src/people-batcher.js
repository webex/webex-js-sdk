/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {Batcher} from '@ciscospark/spark-core';

/**
 * @class
 * @ignore
 */
const PersonUUIDRequestBatcher = Batcher.extend({
  namespace: 'People',

  /**
   * @instance
   * @memberof PersonUUIDRequestBatcher
   * @param {HttpResponseObject} res
   * @returns {Promise}
   */
  handleHttpSuccess(res) {
    return Promise.all(res.body.items.map((personResponse) =>
      this.handleItemSuccess(personResponse.id, personResponse)));
  },

  handleItemFailure(email, response) {
    return this.getDeferredForResponse(email)
      .then((defer) => {
        defer.reject(response);
      });
  },

  /**
   * @instance
   * @memberof PersonUUIDRequestBatcher
   * @param {string} email
   * @param {Object} response
   * @returns {Promise}
   */
  handleItemSuccess(email, response) {
    return this.getDeferredForResponse(email)
      .then((defer) => {
        defer.resolve(response);
      });
  },

  /**
   * @instance
   * @memberof PersonUUIDRequestBatcher
   * @param {string} uuidOrHydraId
   * @returns {Promise<string>}
   */
  fingerprintRequest(uuidOrHydraId) {
    const hydraId = this.spark.people.inferPersonIdFromUuid(uuidOrHydraId);
    return Promise.resolve(hydraId);
  },

  /**
   * @instance
   * @memberof PersonUUIDRequestBatcher
   * @param {string} hydraId
   * @returns {Promise<string>}
   */
  fingerprintResponse(hydraId) {
    return Promise.resolve(hydraId);
  },

  prepareRequest(ids) {
    return Promise.resolve(ids.join());
  },

  /**
   * @instance
   * @memberof PersonUUIDRequestBatcher
   * @param {Object} ids
   * @returns {Promise<HttpResponseObject>}
   */
  submitHttpRequest(ids) {
    return this.spark.request({
      service: 'hydra',
      resource: `people/?id=${ids}&showAllTypes=${this.config.showAllTypes}`
    });
  }
});

export default PersonUUIDRequestBatcher;
