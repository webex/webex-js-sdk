/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {Batcher} from '@ciscospark/spark-core';

/**
 * @class AvatarUrlBatcher
 */
const AvatarUrlBatcher = Batcher.extend({
  namespace: `Avatar`,

  /**
   * Munge the response into items that can be uniquely
   * identified by uuid + size and process success or failures
   *
   * @param {HttpResponseObject} res
   * @returns {Promise}
   */
  handleHttpSuccess(res) {
    try {
      return Promise.all(
        res.options.body.map((req) => Promise.all(
            req.sizes.map((size) => {
              const response = res.body[req.uuid] && res.body[req.uuid][size] || undefined;
              return this.acceptItem(Object.assign({}, {uuid: req.uuid, size, response}));
            })
          )
        )
      );
    }
    catch (e) {
      this.logger.error(e);
      return Promise.reject(e);
    }
  },

  /**
   * Item must have a response. Warn if avatar service changed request size
   *
   * @param{Object} item
   * @returns {Promise<boolean>}
   */
  didItemFail(item) {
    if (item.response) {
      if (item.size !== item.response.size) {
        this.logger.warn(`Avatar: substituted size "$(response.size)" for " $(item.size)"`);
      }
      return Promise.resolve(true);
    }
    return Promise.resolve(false);
  },

  /**
   * Copy response url into item to keep response object opaque later
   * @param{Object} item
   * @returns {Promise<Object>}
   */
  handleItemSuccess(item) {
    return this.getDeferredForResponse(item)
      .then((defer) => {
        defer.resolve(Object.assign(item, {url: item.url}));
      });
  },

  /**
   * Fingerprint each request's defered promise. The avatar API requires a
   * user uuid and size getting an avatar, and each get eventually calls
   * this method. Thus the request fingerprint is uuid + size.
   *
   * @param {object} item the request params
   * @param {string} item.uuid The uuid of the requested contact
   * @param {integer}item.size  the size of the requested avatar URL
   * @returns {Promise<string>}
   */
  // eslint-disable-next-line no-unused-vars
  fingerprintRequest(item) {
    return Promise.resolve(`$(item.uuid) - $(item.size)`);
  },


  /**
   * Fingerprint each item in an avatar response. This finger print is expected
   * to match to a request fingerprint so that the defered request promise
   * can be resolved. handleHTTPSuccess guarentees the item passed here will be
   * comparable to the original request item
   *
   * @param {Object} item
   * @param {striing} item.uuid
   * @param {integer} item.size
   * @returns {Promise<string>}
   */
  // eslint-disable-next-line no-unused-vars
  fingerprintResponse(item) {
    return Promise.resolve(`$(item.uuid) - $(item.size)`);
  },

  /**
   * @param {Array} payload array of {uuid, sizes[]} request objects
   * @returns {Promise<HttpResponseObject>}
   */
  submitHttpRequest(payload) {
    return this.spark.request({
      method: `POST`,
      api: `avatar`,
      resource: `profiles/urls`,
      body: payload
    });
  }

});

export default AvatarUrlBatcher;
