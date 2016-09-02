/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {
  Batcher,
  SparkPlugin
} from '@ciscospark/spark-core';

const AbstractUserUUIDRequestBatcher = Batcher.extend({
  namespace: `User`,

  prepareItem(item) {
    return Promise.resolve({email: item});
  },

  handleHttpSuccess(res) {
    return Promise.all(Object.keys(res.body).map((email) => this.handleItemSuccess(email, res.body[email])));
  },

  handleItemSuccess(email, response) {
    return this.getDeferredForResponse(email)
      .then((defer) => {
        defer.resolve(response);
      });
  },

  fingerprintRequest(email) {
    return Promise.resolve(email.email || email);
  },

  fingerprintResponse(email) {
    return Promise.resolve(email);
  }
});

const FakeUserUUIDRequestBatcher = AbstractUserUUIDRequestBatcher.extend({
  submitHttpRequest(payload) {
    return this.spark.request({
      method: `POST`,
      service: `conversation`,
      resource: `/users`,
      body: payload
    });
  }
});

const RealUserUUIDRequestBatcher = AbstractUserUUIDRequestBatcher.extend({
  submitHttpRequest(payload) {
    return this.spark.request({
      method: `POST`,
      service: `conversation`,
      resource: `/users`,
      body: payload,
      qs: {
        shouldCreateUsers: true
      }
    });
  }
});

const UserUUIDBatcher = SparkPlugin.extend({
  children: {
    faker: FakeUserUUIDRequestBatcher,
    creator: RealUserUUIDRequestBatcher
  },

  request(payload) {
    return payload.create ? this.creator.request(payload.email) : this.faker.request(payload.email);
  }
});

export default UserUUIDBatcher;
