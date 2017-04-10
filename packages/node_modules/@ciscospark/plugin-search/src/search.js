/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {get} from 'lodash';
import {oneFlight} from '@ciscospark/common';
import {SparkPlugin} from '@ciscospark/spark-core';

const Search = SparkPlugin.extend({
  namespace: `Search`,

  people(options) {
    options = options || {};

    if (!options.queryString && options.query) {
      options.queryString = options.query;
      Reflect.deleteProperty(options, `query`);
    }

    if (!options.queryString) {
      return Promise.reject(new Error(`\`options.query\` is required`));
    }

    return this.request({
      api: `argonaut`,
      resource: `directory`,
      method: `POST`,
      body: options
    })
      .then((res) => res.body);
  },

  @oneFlight
  bindSearchKey() {
    return this.spark.encryption.kms.createUnboundKeys({count: 1})
      .then(([key]) => this.spark.encryption.kms.createResource({
        key,
        userIds: [this.spark.device.userId]
      })
        .then(() => this.spark.device.set(`searchEncryptionKeyUrl`, key.uri)));
  },

  search(options) {
    /* eslint max-nested-callbacks: [0] */
    options = options || {};

    if (!options.query) {
      return Promise.resolve([]);
    }

    let promise = Promise.resolve();
    if (!this.spark.device.searchEncryptionKeyUrl) {
      promise = this.bindSearchKey();
    }

    return promise
      .then(() => this.spark.request({
        service: `argonaut`,
        resource: `search`,
        method: `POST`,
        body: Object.assign(options, {
          searchEncryptionKeyUrl: this.spark.device.searchEncryptionKeyUrl
        })
      }))
      .then((res) => get(res, `body.activities.items`) || []);
  }

});

export default Search;
