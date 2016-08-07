/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {SparkPlugin2, RequestBatcher} from '@ciscospark/spark-core';

const creators = new WeakMap();
const fakers = new WeakMap();

class UUIDRequestBatcher extends RequestBatcher {
  generateKey(payload) {
    return payload;
  }

  batchWillExecute(queue) {
    return queue.map((email) => ({email}));
  }

  requestWillSucceed(email, response) {
    return Promise.resolve(response.body[email]);
  }

  submit(body) {
    return this.spark.request({
      method: `POST`,
      api: `conversation`,
      resource: `users`,
      body,
      qs: {
        shouldCreateUsers: true
      }
    });
  }
}

class FakeUUIDRequestBatcher extends UUIDRequestBatcher {
  submit(body) {
    return this.spark.request({
      method: `POST`,
      api: `conversation`,
      resource: `users`,
      body
    });
  }
}

export default class UserUUIDRequestBatcher extends SparkPlugin2 {
  get creator() {
    return creators.get(this);
  }

  get faker() {
    return fakers.get(this);
  }

  constructor(...args) {
    super(...args);

    creators.set(this, new UUIDRequestBatcher(...args));
    fakers.set(this, new FakeUUIDRequestBatcher(...args));
  }

  enqueue(payload) {
    return payload.create ? this.creator.enqueue(payload.email) : this.faker.enqueue(payload.email);
  }
}
