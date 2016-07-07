/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var decryptProcessor = {
  post: {
    onReject: function onReject(res) {
      if (res.body && res.body.errorCode === 1900000) {
        return this.spark.encryption.kms.decryptKmsMessage(res.body.message)
          .then(function replaceErrorString(kmsMessage) {
            this.logger.error('received encrypted error message', kmsMessage);
            res.body.message = kmsMessage;

            return Promise.reject(res);
          }.bind(this));
      }

      return Promise.reject(res);
    }
  }
};

module.exports = decryptProcessor;
