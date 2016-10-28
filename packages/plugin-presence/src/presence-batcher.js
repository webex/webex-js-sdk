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
    return Promise.all(res.body.statusList.map(() => this.acceptItem(res)));
  },

  handleItemFailure(item) {

  },

  handleItemSuccess(item) {
    return this.getDeferredForRequest(item)
      .then((defer) => defer.resolve(item));
  },

  prepareRequest(queue) {
    const payload = {
      subjects: queue
    };

    return Promise.resolve(payload);
  },

  submitHttpRequest(payload) {
    console.log('parent', this.parent);

    return this.spark.request({
      method: `post`,
      api: `apheleia`,
      resource: `compositions`,
      body: payload
    });
  }
});

export default PresenceBatcher;
