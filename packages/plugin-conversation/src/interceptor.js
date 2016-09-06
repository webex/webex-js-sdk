/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {Interceptor} from '@ciscospark/http-core';
import {isArray} from 'lodash';

export default class ConversationInterceptor extends Interceptor {
  static create() {
    return new ConversationInterceptor({spark: this});
  }

  onRequest(options) {
    if (!options.method || options.method.toUpperCase() === `GET`) {
      return options;
    }

    return this.spark.device.isSpecificService(`conversation`, options.service || options.uri)
      .then((isConversationService) => {
        if (!isConversationService) {
          return options;
        }

        // FIXME this feels brittle
        if (options.resource !== `content` && options.resource !== `activities` && options.resource !== `conversations`) {
          return options;
        }

        return this.spark.conversation.encrypter.encryptObject(options.body)
          .then((body) => {
            options.body = body;
            return options;
          });
      });
  }

  onResponse(options, response) {
    return this.shouldDecrypt(options, response)
      .then((shouldDecrypt) => {
        if (!shouldDecrypt) {
          return response;
        }

        return this.spark.conversation.decrypter.decryptObject(null, response.body)
          .then((body) => this.spark.conversation.normalizer.normalize(body))
          .then((body) => {
            response.body = body;
            return response;
          });
      });
  }

  shouldDecrypt(options, response) {
    return this.spark.device.isSpecificService(`conversation`, options.service || options.uri)
      .then((isConversationService) => {
        if (!isConversationService) {
          return false;
        }

        if (isArray(response.body) && response.body[0].objectType) {
          return true;
        }

        if (isArray(response.body.items) && response.body.items[0].objectType) {
          return true;
        }

        if (response.body.objectType) {
          return true;
        }

        return false;
      });
  }
}
