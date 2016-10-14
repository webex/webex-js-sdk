/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {Batcher} from '@ciscospark/spark-core';

const AvatarUrlBatcher = Batcher.extend({
  namespace: `Avatar`,

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

  didItemFail(item) {
    if (item.response) {
      if (item.size !== item.response.size) {
        this.logger.warn(`Avatar: substituted size "${item.response.size}" for "${item.size}"`);
      }
      return Promise.resolve(true);
    }
    return Promise.resolve(false);
  },

  handleItemSuccess(item) {
    return this.getDeferredForResponse(item)
      .then((defer) =>
        defer.resolve(Object.assign(item, {url: item.url})));
  },

  fingerprintRequest(item) {
    return Promise.resolve(`${item.uuid}-${item.size}`);
  },


  fingerprintResponse(item) {
    return Promise.resolve(`${item.uuid}-${item.size}`);
  },

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
