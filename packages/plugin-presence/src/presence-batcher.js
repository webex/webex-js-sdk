/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {Batcher} from '@ciscospark/spark-core';

const PresenceBatcher = Batcher.extend({
  namespace: `Presence`,

  didItemFail(item) {

  },

  fingerprintRequest(item) {
    return Promise.resolve(`${item}`);
  },

  fingerprintResponse(item) {
    return Promise.resolve(`${item.subject}`);
  },

  handleHttpError(reason) {

  },

  handleHttpSuccess(res) {

  },

  handleItemFailure(item) {

  },

  handleItemSuccess(item) {

  },

  prepareRequest(queue) {

  },

  submitHttpRequest(payload) {
    return this.spark.request({
      method: `post`,
      api: `apheleia`,
      resource: `compositions`,
      body: payload
    });
  }
});

export default PresenceBatcher;
