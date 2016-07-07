/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var SparkBase = require('../../../lib/spark-base');
var resolveWith = require('../../../util/resolve-with');

var SearchService = SparkBase.extend({
  /** @lends Search.SearchService.prototype */
  namespace: 'Search',

  /**
   * Searches for users given a query string.
   * @param  {Object|SearchObject} params
   * @param {string} params.queryString, string to search for
   * @param {boolean} params.includeRooms, includes room information for each result
   * @param {int} params.size, number of results returned
   * @return {Promise} Resolves with the results from the request query
   */
  people: function people(params) {
    if (!params || !params.queryString) {
      return Promise.reject(new Error('`params.query` is required'));
    }

    return this.request({
      api: 'argonaut',
      resource: 'directory',
      method: 'POST',
      body: params
    })
      .then(function processResponse(res) {
        return res.body;
      });
  },

  /**
   * Searches for the given string.
   * @param  {Object|SearchObject} params
   * @param  {string} params.query, string to search for
   * @param  {int} params.limit, number of results returned
   * @param  {string} params.type, type of object to search
   * @param  {Array} params.sharedBy, array of user IDs
   * @param  {Array} params.sharedIn, array of rooms
   * @param  {Date} params.startDate
   * @param  {Date} params.endDate
   * @return {Promise} Resolves with the results from the requested query
   */
  search: function search(params) {
    if (!params || !params.query) {
      return Promise.resolve([]);
    }
    return this._prepareKmsMessage()
      .then(function prepareParams(req) {
        params.kmsMessage = req.kmsMessage;
        params.searchEncryptionKeyUrl = req.keyUrl;
        return this._encryptQuery(params.query, req.keyUrl)
          .then(function requestSearch(query) {
            params.query = query;
            return this.request({
              api: 'argonaut',
              resource: 'search',
              method: 'POST',
              body: params
            });
          }.bind(this))
          .then(function processResponse(res) {
            if (!res.body || !res.body.activities || !res.body.activities.items) {
              return [];
            }
            return this._decryptKmsMessage(res)
              .then(function processSearchResults() {
                var items = res.body.activities.items;
                return Promise.all(items.map(function decryptActivity(activity) {
                  var decrypter = this.spark.conversation.decrypter;
                  var normalizer = this.spark.conversation.inboundNormalizer;
                  return decrypter.decryptObject(activity)
                    .then(normalizer.normalize.bind(normalizer));
                }.bind(this)));
              }.bind(this))
              .then(resolveWith(res.body.activities.items));
          }.bind(this));
      }.bind(this));
  },

  /**
   * Prepares the KMS message and returns it with the key URL.
   * @access private
   * @return {Object} object containing the key URL and KMS message, if any.
   */
  _prepareKmsMessage: function _prepareKmsMessage() {
    var retval = {};
    var keyUrl_ = this.spark.device.searchKeyUrl;
    if (keyUrl_) {
      retval.keyUrl = keyUrl_;
      return Promise.resolve(retval);
    }
    return this.spark.encryption.getUnusedKey()
      .then(function setKeyUrl(key) {
        this.spark.device.set('searchKeyUrl', key.keyUrl);
        return key.keyUrl;
      }.bind(this))
      .then(function prepareKmsMessage(keyUrl) {
        var kmsMessage = {
          method: 'create',
          uri: '/resources',
          keyUris: [keyUrl],
          userIds: [this.spark.device.userId]
        };
        return this.spark.encryption.kms.prepareRequest(kmsMessage)
          .then(function sendKmsRequest(req) {
            return this.spark.encryption.kms.request(req);
          }.bind(this))
          .then(function prepareReturnObject(req) {
            retval.keyUrl = keyUrl;
            retval.kmsMessage = req.wrapped;
            return Promise.resolve(retval);
          });
      }.bind(this));
  },

  /**
   * Encrypts querystring with the given key.
   * @access private
   * @param  {string} query query string to search for
   * @param  {Object|keyUrl} keyUrl key URL used for encryption/decryption
   * @return {Promise} Resolves with encrypted querystring
   */
  _encryptQuery: function _encryptQuery(query, keyUrl) {
    return this.spark.encryption.encryptText(query, keyUrl);
  },

  /**
   * Decrypts the KMS message, if present.
   * @access private
   * @param  {Object} res result returned from search endpoint
   * @return {Promise} Resolves with decrypted KMS message, if present
   */
  _decryptKmsMessage: function _decryptKmsMessage(res) {
    if (!res.body.kmsMessage) {
      return Promise.resolve();
    }
    return this.spark.encryption.kms.decryptKmsMessage(res.body.kmsMessage);
    // In the future, we may keep track of the KRO returned from the KMS message.
  }
});

module.exports = SearchService;
