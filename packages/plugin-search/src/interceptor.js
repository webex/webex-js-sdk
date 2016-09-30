/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {Interceptor as ConversationInterceptor} from '@ciscospark/plugin-conversation';
import {has} from 'lodash';

export default class SearchInterceptor extends ConversationInterceptor {
  /**
   * @returns {SearchInterceptor}
   */
  static create() {
    return new SearchInterceptor({spark: this});
  }

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

  encryptRequest(options) {
    return super.encryptRequest(options)
      .then(() => {
        if (options.query && options.searchEncryptionKeyUrl) {
          return this.spark.encryption.encryptText(options.searchEncryptionKeyUrl, options.query)
            .then((q) => {
              options.query = q;
              return options;
            });
        }
        return options;
      });
  }

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

  shouldDecryptResponse(options, response) {
    return super.shouldDecryptResponse(options, response)
      .then((shouldDecryptResponse) => Boolean(shouldDecryptResponse || has(response, `body.activities.items`)));
  }

  shouldEncryptRequest(options) {
    return super.shouldEncryptRequest(options)
      .then((shouldEncryptRequest) => {
        if (shouldEncryptRequest) {
          return true;
        }

        return this.spark.device.isSpecificService(`argonaut`, options.service || options.uri)
          .then((isArgonautService) => Boolean(isArgonautService && options.query && options.searchEncryptionKeyUrl));
      });
  }

  shouldNormalizeResponse(options, response) {
    return super.shouldNormalizeResponse(options, response)
      .then((shouldNormalizeResponse) => Boolean(shouldNormalizeResponse || has(response, `body.activities.items`)));
  }
}
