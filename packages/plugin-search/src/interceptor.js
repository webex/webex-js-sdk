/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

/* eslint no-invalid-this: [0] */
/* eslint max-nested-callbacks: [0] */


import {Interceptor as ConversationInterceptor} from '@ciscospark/plugin-conversation';
import {get, has, set, wrap} from 'lodash';


Object.assign(ConversationInterceptor.prototype, {
  /**
   * Decrypts a response
   * @param {Object} options
   * @param {Object} response
   * @returns {Promise<HttpResponseObject>}
   */
  decryptResponse: wrap(ConversationInterceptor.prototype.decryptResponse, function decryptResponse(fn, options, response) {
    return Reflect.apply(fn, this, [options, response])
      .then(() => {
        if (has(response, `body.activities.items`)) {
          return this.spark.conversation.decrypter.decryptObject(null, response.body.activities.items)
            .then((body) => {
              response.body.activities.items = body;
              return response;
            });
        }

        return response;
      });
  }),

  /**
   * Encrypts a request
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  encryptRequest: wrap(ConversationInterceptor.prototype.encryptRequest, function encryptRequest(fn, options) {
    return Reflect.apply(fn, this, [options])
      .then(() => {
        if (has(options, `body.query`) && has(options, `body.searchEncryptionKeyUrl`)) {
          return this.spark.encryption.encryptText(get(options, `body.searchEncryptionKeyUrl`), get(options, `body.query`))
            .then((q) => {
              set(options, `body.query`, q);
              return options;
            });
        }
        return options;
      });
  }),

  /**
   * Normalizes a response
   * @param {Object} options
   * @param {Object} response
   * @returns {Promise<HttpResponseObject>}
   */
  normalizeResponse: wrap(ConversationInterceptor.prototype.normalizeResponse, function normalizeResponse(fn, options, response) {
    return Reflect.apply(fn, this, [options, response])
      .then(() => {
        if (!has(response, `body.activities.items`)) {
          return response;
        }

        return this.spark.conversation.inboundNormalizer.normalize(response.body.activities.items)
          .then((body) => {
            response.body.activities.items = body;
          });
      });
  }),

  /**
   * Determines if the specified response contains encrypted values
   * @param {Object} options
   * @param {Object} response
   * @returns {Promise<Object>}
   */
  shouldDecryptResponse: wrap(ConversationInterceptor.prototype.shouldDecryptResponse, function shouldDecryptResponse(fn, options, response) {
    return Reflect.apply(fn, this, [options, response])
      .then((should) => Boolean(should || has(response, `body.activities.items`)));
  }),


  /**
   * Determines if a request should be encrypted
   * @param {Object} options
   * @returns {Promise<Boolean>}
   */
  shouldEncryptRequest: wrap(ConversationInterceptor.prototype.shouldEncryptRequest, function shouldEncryptRequest(fn, options) {
    return Reflect.apply(fn, this, [options])
      .then((should) => {
        if (should) {
          return true;
        }

        return this.spark.device.isSpecificService(`argonaut`, options.service || options.uri)
          .then((isArgonautService) => Boolean(isArgonautService && has(options, `body.query`) && has(options, `body.searchEncryptionKeyUrl`)));
      });
  }),

  /**
   * Determines if a response should be normalized
   * @param {Object} options
   * @param {Object} response
   * @returns {Promise<Boolean>}
   */
  shouldNormalizeResponse: wrap(ConversationInterceptor.prototype.shouldNormalizeResponse, function shouldNormalizeResponse(fn, options, response) {
    return Reflect.apply(fn, this, [options, response])
      .then((should) => Boolean(should || has(response, `body.activities.items`)));
  })
});
