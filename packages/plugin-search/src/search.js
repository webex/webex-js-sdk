/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {isArray} from 'lodash';
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

  search(options) {
    /* eslint max-nested-callbacks: [0] */
    options = options || {};

    if (!options.query) {
      return Promise.resolve([]);
    }

    let results = {};
    return this._prepareKmsMessage()
      .then((key) => this.spark.encryption.encryptText(key.keyUrl, options.query)
          .then((query) => {
            options.query = query;
            options.searchEncryptionKeyUrl = key.keyUrl;
            return this.request({
              api: `argonaut`,
              resource: `search`,
              method: `POST`,
              body: options
            });
          })
          .then((res) => {
            results = res;
            if (!results.body || !results.body.activities || !results.body.activities.items) {
              return [];
            }
            return results.body.activities.items;
          })
      );
  },

  _prepareKmsMessage() {
    const keyUrl_ = this.spark.device.searchKeyUrl;
    if (keyUrl_) {
      return Promise.resolve({keyUrl: keyUrl_});
    }

    return this.spark.encryption.kms.createUnboundKeys({count: 1})
      .then((returnKey) => {
        const key = isArray(returnKey) ? returnKey[0] : returnKey;
        this.spark.device.set(`searchKeyUrl`, key.uri);
        return key.uri;
      })
      .then((keyUrl) => this.spark.encryption.kms.createResource({
        userIds: [this.spark.device.userId],
        keyUris: [keyUrl]
      })
        .then(() => ({keyUrl}))
      );
  },

  /*
  .then((request) => {
    console.log(`prepareRequest finished`);
    return request;
  })
  .then((request) => this.spark.encryption.kms.request(request))
  .then(() => {console.log(`request finished`);})
   */

  _encryptQuery({query, keyUrl}) {
    return this.spark.encryption.encryptText(query, keyUrl);
  },

  _decryptKmsMessage(activity) {
    if (!activity.body.kmsMessage) {
      return Promise.resolve();
    }
    return this.spark.encryption.kms.decryptKmsMessage(activity.body.kmsMessage);
  }
});

export default Search;
