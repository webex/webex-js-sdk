/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {Interceptor as ConversationInterceptor} from '@ciscospark/plugin-conversation';
import {get, has, set} from 'lodash';

/**
 * Encrypts, Normalizes, and Decrypts search service payloads
 */
export default class SearchInterceptor extends ConversationInterceptor {
  /**
   * @returns {SearchInterceptor}
   */
  static create() {
    return new SearchInterceptor({spark: this});
  }

  /**
   * Decrypts a response
   * @param {Object} options
   * @param {Object} response
   * @returns {Promise<HttpResponseObject>}
   */
  decryptResponse(options, response) {
    return super.decryptResponse(options, response)
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
  }

  /**
   * Encrypts a request
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  encryptRequest(options) {
    return super.encryptRequest(options)
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
  }

  /**
   * Normalizes a response
   * @param {Object} options
   * @param {Object} response
   * @returns {Promise<HttpResponseObject>}
   */
  normalizeResponse(options, response) {
    return super.normalizeResponse(options, response)
      .then(() => {
        if (!has(response, `body.activities.items`)) {
          return response;
        }

        return this.spark.conversation.inboundNormalizer.normalize(response.body.activities.items)
          .then((body) => {
            response.body.activities.items = body;
          });
      });
  }

  /**
   * Determines if the specified response contains encrypted values
   * @param {Object} options
   * @param {Object} response
   * @returns {Promise<Object>}
   */
  shouldDecryptResponse(options, response) {
    return super.shouldDecryptResponse(options, response)
      .then((shouldDecryptResponse) => Boolean(shouldDecryptResponse || has(response, `body.activities.items`)));
  }


  /**
   * Determines if a request should be encrypted
   * @param {Object} options
   * @returns {Promise<Boolean>}
   */
  shouldEncryptRequest(options) {
    return super.shouldEncryptRequest(options)
      .then((shouldEncryptRequest) => {
        if (shouldEncryptRequest) {
          return true;
        }

        return this.spark.device.isSpecificService(`argonaut`, options.service || options.uri)
          .then((isArgonautService) => Boolean(isArgonautService && has(options, `body.query`) && has(options, `body.searchEncryptionKeyUrl`)));
      });
  }

  /**
   * Determines if a response should be normalized
   * @param {Object} options
   * @param {Object} response
   * @returns {Promise<Boolean>}
   */
  shouldNormalizeResponse(options, response) {
    return super.shouldNormalizeResponse(options, response)
      .then((shouldNormalizeResponse) => Boolean(shouldNormalizeResponse || has(response, `body.activities.items`)));
  }
}
