/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {SparkHttpError} from '@ciscospark/spark-core';
import {Interceptor} from '@ciscospark/http-core';

export default class EncryptionInterceptor extends Interceptor {
  /**
   * @returns {EncryptionInterceptor}
   */
  static create() {
    return new EncryptionInterceptor({spark: this});
  }

  onRequest(options) {
    if (options.body && options.body.kmsMessage) {
      return this.spark.encryption.kms.prepareRequest(options.body.kmsMessage)
        .then((req) => {
          options.body.kmsMessage = req.wrapped;
          return options;
        });
    }

    return options;
  }

  onResponse(options, response) {
    if (response.body && response.body.kmsMessage) {
      return this.spark.encryption.kms.decryptKmsMessage(response.body.kmsMessage)
        .then((kmsMessage) => {
          response.body.kmsMessage = kmsMessage;
          return response;
        });
    }

    return response;
  }

  onResponseError(options, reason) {
    if (reason.body && reason.body.errorCode === 1900000) {
      const promises = reason.body.errors.map((error) => this.spark.encryption.kms.decryptKmsMessage(error.description)
        .then((desc) => {error.description = desc;}));
      return Promise.all(promises)
        .then(() => this.spark.encryption.kms.decryptKmsMessage(reason.body.message)
          .then((kmsMessage) => {
            reason.body.message = kmsMessage;
            const E = SparkHttpError.select(reason.statusCode);
            return Promise.reject(new E(reason));
          }));
    }

    return Promise.reject(reason);
  }
}
