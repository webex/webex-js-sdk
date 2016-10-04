/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {Interceptor} from '@ciscospark/http-core';
import {
  get,
  has,
  isArray,
  set
} from 'lodash';

/**
 * Encrypts, Normalizes, and Decrypts conversation service payloads
 */
export default class ConversationInterceptor extends Interceptor {
  /**
   * @returns {ConversationInterceptor}
   */
  static create() {
    return new ConversationInterceptor({spark: this});
  }

  /**
   * @see Interceptor#onRequest
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  onRequest(options) {
    return this.shouldNormalizeRequest(options)
      .then((shouldNormalizeRequest) => {
        if (!shouldNormalizeRequest) {
          return Promise.resolve();
        }
        return this.normalizeRequest(options);
      })
      .then(() => this.shouldEncryptRequest(options))
      .then((shouldEncrypt) => {
        if (!shouldEncrypt) {
          return Promise.resolve();
        }

        return this.encryptRequest(options);
      })
      .then(() => options);
  }

  /**
   * @see Interceptor#onResponse
   * @param {Object} options
   * @param {Object} response
   * @returns {Promise<Object>}
   */
  onResponse(options, response) {
    return this.shouldDecryptResponse(options, response)
      .then((shouldDecrypt) => {
        if (!shouldDecrypt) {
          return Promise.resolve();
        }

        return this.decryptResponse(options, response);
      })
      .then(() => this.shouldNormalizeResponse(options, response))
      .then((shouldNormalizeResponse) => {
        if (!shouldNormalizeResponse) {
          return Promise.resolve();
        }
        return this.normalizeResponse(options, response);
      })
      .then(() => response);
  }

  /**
   * Decrypts a response
   * @param {Object} options
   * @param {Object} response
   * @returns {Promise<HttpResponseObject>}
   */
  decryptResponse(options, response) {
    const hasItems = has(response, `body.items`);
    return this.spark.conversation.decrypter.decryptObject(null, get(response, hasItems ? `body.items` : `body`))
      .then((body) => {
        set(response, hasItems ? `body.items` : `body`, body);
        return response;
      });
  }

  /**
   * Encrypts a request
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  encryptRequest(options) {
    if (!has(options, `body.objectType`)) {
      return Promise.resolve(options);
    }

    return this.spark.conversation.encrypter.encryptObject(options.body)
      .then((body) => {
        options.body = body;
        return options;
      });
  }

  /**
   * Normalizes a request
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  normalizeRequest(options) {
    if (!(isArray(options.body) && options.body[0] && options.body[0].objectType || has(options, `body.objectType`))) {
      return Promise.resolve(options);
    }

    return this.spark.conversation.outboundNormalizer.normalize(options.body)
      .then((body) => {
        options.body = body;
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
    if (has(response, `body.items`)) {
      return this.spark.conversation.inboundNormalizer.normalize(response.body.items)
        .then((b) => {
          response.body.items = b;
          return response;
        });
    }

    if (has(response, `body.objectType`)) {
      return this.spark.conversation.inboundNormalizer.normalize(response.body)
        .then((b) => {
          response.body = b;
          return response;
        });
    }

    return Promise.resolve(response);
  }

  /**
   * Determines if the specified response contains encrypted values
   * @param {Object} options
   * @param {Object} response
   * @returns {Promise<Object>}
   */
  shouldDecryptResponse(options, response) {
    if (options.shouldDecryptResponse === false) {
      return Promise.resolve(false);
    }

    return this.spark.device.isSpecificService(`conversation`, options.service || options.uri)
      .then((isConversationService) => {
        if (!isConversationService) {
          return options;
        }

        if (isArray(response.body) && response.body[0].objectType) {
          return true;
        }

        if (isArray(response.body.items) && response.body.items.length && response.body.items[0].objectType) {
          return true;
        }

        if (response.body.objectType) {
          return true;
        }

        // required for plugin-flag multistatus object
        if (options.resource === `bulk_activities_fetch`) {
          return true;
        }

        return false;
      });
  }

  /**
   * Determines if a request should be encrypted
   * @param {Object} options
   * @returns {Promise<Boolean>}
   */
  shouldEncryptRequest(options) {
    if (options.shouldEncryptRequest === false || !options.method || options.method.toUpperCase() === `GET`) {
      return Promise.resolve(false);
    }

    return this.spark.device.isSpecificService(`conversation`, options.service || options.uri)
      .then((isConversationService) => {
        if (!isConversationService) {
          return false;
        }

        if (options.resource !== `content` && options.resource !== `activities` && options.resource !== `conversations` && options.resource !== `teams`) {
          return options;
        }

        return true;
      });
  }

  /**
   * Determines if a response should be normalized
   * @param {Object} options
   * @param {Object} response
   * @returns {Promise<Boolean>}
   */
  shouldNormalizeResponse(options, response) {
    // We only want to use the local logic, so explicity call the
    // ConversationInterceptor implementation
    return Reflect.apply(ConversationInterceptor.prototype.shouldDecryptResponse, this, [options, response]);
  }

  /**
   * Determines if a request should be normalized
   * @param {Object} options
   * @returns {Promise<Boolean>}
   */
  shouldNormalizeRequest(options) {
    // We only want to use the local logic, so explicity call the ConversationInterceptor implementation
    return Reflect.apply(ConversationInterceptor.prototype.shouldEncryptRequest, this, [options]);
  }

}
