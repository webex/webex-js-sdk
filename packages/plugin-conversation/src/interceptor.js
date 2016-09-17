/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {Interceptor} from '@ciscospark/http-core';
import {isArray} from 'lodash';

/**
 * Encrypts, Normalizes, and Decrypts conversation service payloads
 */
export default class ConversationInterceptor extends Interceptor {
  /**
   * @returns {EncryptionInterceptor}
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
    if (!options.method || options.method.toUpperCase() === `GET`) {
      return options;
    }

    return this.spark.device.isSpecificService(`conversation`, options.service || options.uri)
      .then((isConversationService) => {
        if (!isConversationService) {
          return options;
        }

        if (options.resource !== `content` && options.resource !== `activities` && options.resource !== `conversations`) {
          return options;
        }

        return this.spark.conversation.outboundNormalizer.normalize(options.body)
          .then((body) => this.spark.conversation.encrypter.encryptObject(body))
          .then((body) => {
            options.body = body;
            return options;
          });
      });
  }

  /**
   * @see Interceptor#onResponse
   * @param {Object} options
   * @param {Object} response
   * @returns {Promise<Object>}
   */
  onResponse(options, response) {
    return this.shouldDecrypt(options, response)
      .then((shouldDecrypt) => {
        if (!shouldDecrypt) {
          return response;
        }

        const hasItems = Boolean(response.body.items);

        return this.spark.conversation.decrypter.decryptObject(null, response.body)
          .then((body) => this.spark.conversation.inboundNormalizer.normalize(hasItems ? body.items : body))
          .then((body) => {
            if (hasItems) {
              response.body.items = body;
            }
            else {
              response.body = body;
            }
            return response;
          });
      });
  }

  /**
   * Determines if the specified response contains encrypted values
   * @param {Object} options
   * @param {Object} response
   * @returns {Promise<Object>}
   */
  shouldDecrypt(options, response) {
    return this.spark.device.isSpecificService(`conversation`, options.service || options.uri)
      .then((isConversationService) => {
        if (!isConversationService) {
          return false;
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

        return false;
      });
  }
}
