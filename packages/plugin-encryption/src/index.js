/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

// Note: There's a bug where if bind gets replayed because of a timeout in which
// the original request eventually completed, there'll be an error indicating
// the key can't be bound (because it already has been). This could be mitigated
// by using Promise.race to resolve replays (as more requests get enqueue for a
// specific action, accept whichever one completes first).

import {registerPlugin, SparkHttpError} from '@ciscospark/spark-core';
import Encryption from './encryption';
import config from './config';
import {has} from 'lodash';

import '@ciscospark/plugin-wdm';
import '@ciscospark/plugin-mercury';

registerPlugin(`encryption`, Encryption, {
  payloadTransformer: {
    predicates: [{
      name: `encryptKmsMessage`,
      direction: `outbound`,
      test(options) {
        return Promise.resolve(has(options, `body.kmsMessage`));
      },
      extract(options) {
        return Promise.resolve(options.body);
      }
    }, {
      name: `decryptKmsMessage`,
      direction: `inbound`,
      test(response) {
        return Promise.resolve(has(response, `body.kmsMessage`));
      },
      extract(response) {
        return Promise.resolve(response.body);
      }
    }, {
      name: `decryptErrorResponse`,
      direction: `inbound`,
      test(reason) {
        return Promise.resolve(Boolean(reason.body && reason.body.errorCode === 1900000));
      }
    }],
    transforms: [{
      name: `encryptKmsMessage`,
      fn(ctx, object) {
        return ctx.spark.encryption.kms.prepareRequest(object.kmsMessage)
          .then((req) => {
            object.kmsMessage = req.wrapped;
            return object;
          });
      }
    }, {
      name: `decryptKmsMessage`,
      fn(ctx, object) {
        return ctx.spark.encryption.kms.decryptKmsMessage(object.kmsMessage)
          .then((kmsMessage) => {
            object.kmsMessage = kmsMessage;
            return object;
          });
      }
    }, {
      name: `decryptErrorResponse`,
      fn(ctx, reason) {
        const promises = reason.body.errors.map((error) => ctx.spark.encryption.kms.decryptKmsMessage(error.description)
          .then((desc) => {
            error.description = desc;
          }));

        promises.push(ctx.spark.encryption.kms.decryptKmsMessage(reason.body.message)
          .then((kmsMessage) => {
            reason.body.message = kmsMessage;
          }));

        return Promise.all(promises)
          .then(() => {
            const E = SparkHttpError.select(reason.statusCode);
            return Promise.reject(new E(reason));
          });
      }
    }]
  },

  config
});

export {default as default} from './encryption';
export {default as KMS} from './kms';
