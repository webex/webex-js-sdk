/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {Batcher} from '@webex/webex-core';
import {uniq} from 'lodash';

/**
 * AvatarUrlBatcher class for handling avatar URL request batching
 * @class
 * @extends Batcher
 */
class AvatarUrlBatcher extends Batcher {
  namespace = 'Avatar';

  /**
   * Handle successful HTTP response
   * @param {any} res - The HTTP response object
   * @returns {Promise<void>} Promise resolving when all items are processed
   */
  handleHttpSuccess(res) {
    // eslint-disable-next-line arrow-body-style
    return Promise.all(
      res.options.body.map((req) => {
        return Promise.all(
          req.sizes.map((size) => {
            const response = (res.body[req.uuid] && res.body[req.uuid][size]) || undefined;

            return this.acceptItem({
              response,
              uuid: req.uuid,
              size,
            });
          })
        );
      })
    ).then(() => {});
  }

  /**
   * Handle HTTP error
   * @param {any} reason - The error reason
   * @returns {Promise<void>} Promise resolving when all errors are handled
   */
  handleHttpError(reason) {
    const msg = reason.message || reason.body || reason;

    // avoid multiple => on same line
    // eslint-disable-next-line arrow-body-style
    return Promise.all(
      reason.options.body.map((item) => {
        return Promise.all(
          item.sizes.map((size) =>
            this.getDeferredForRequest({
              uuid: item.uuid,
              size,
            })
              // I don't see a better way to do this than with an additional nesting
              // eslint-disable-next-line max-nested-callbacks
              .then((defer) => defer.reject(msg instanceof Error ? msg : new Error(msg)))
          )
        );
      })
    ).then(() => {});
  }

  /**
   * Check if the item failed
   * @param {any} item - The item to check
   * @returns {Promise<boolean>} Promise resolving to failure status
   */
  didItemFail(item) {
    if (item.response) {
      if (item.size !== item.response.size) {
        this.logger.warn(`Avatar: substituted size "${item.response.size}" for "${item.size}"`);
      }

      return Promise.resolve(false);
    }

    return Promise.resolve(true);
  }

  /**
   * Handle item failure
   * @param {any} item - The item that failed
   * @returns {Promise<void>} Promise resolving when failure is handled
   */
  handleItemFailure(item) {
    return this.getDeferredForRequest(item).then((defer) => {
      defer.reject(new Error(item.response || 'Failed to retrieve avatar'));
    });
  }

  /**
   * Handle item success
   * @param {any} item - The item that succeeded
   * @returns {Promise<void>} Promise resolving when success is handled
   */
  handleItemSuccess(item) {
    return this.getDeferredForResponse(item).then((defer) =>
      defer.resolve({
        hasDefaultAvatar: item.response.defaultAvatar,
        uuid: item.uuid,
        size: item.size,
        url: item.response.url,
      })
    );
  }

  /**
   * Create fingerprint for request
   * @param {any} item - The item to fingerprint
   * @returns {Promise<string>} Promise resolving to the fingerprint
   */
  fingerprintRequest(item) {
    return Promise.resolve(`${item.uuid}-${item.size}`);
  }

  /**
   * Create fingerprint for response
   * @param {any} item - The item to fingerprint
   * @returns {Promise<string>} Promise resolving to the fingerprint
   */
  fingerprintResponse(item) {
    return Promise.resolve(`${item.uuid}-${item.size}`);
  }

  /**
   * Prepare the request from the queue
   * @param {any[]} queue - Array of items to prepare
   * @returns {Promise<any[]>} Promise resolving to the prepared request
   */
  prepareRequest(queue) {
    const map = queue.reduce((m, item) => {
      let o = m.get(item.uuid);

      if (!o) {
        o = [];
        m.set(item.uuid, o);
      }
      o.push(item.size);

      return m;
    }, new Map());

    const payload = [];

    map.forEach((value, key) => {
      payload.push({
        uuid: key,
        sizes: uniq(value),
      });
    });

    return Promise.resolve(payload);
  }

  /**
   * Submit the HTTP request
   * @param {any} payload - The payload to submit
   * @returns {Promise<any>} Promise resolving to the HTTP response
   */
  submitHttpRequest(payload) {
    return this.webex.request({
      method: 'POST',
      api: 'avatar',
      resource: 'profiles/urls',
      body: payload,
    });
  }
}

export default AvatarUrlBatcher;
