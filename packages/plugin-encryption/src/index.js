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
import {has, isObject, isString} from 'lodash';

import '@ciscospark/plugin-wdm';
import '@ciscospark/plugin-mercury';

registerPlugin(`encryption`, Encryption, {
  payloadTransformer: {
    predicates: [{
      name: `encryptKmsMessage`,
      direction: `outbound`,
      // I don't see any practical way to reduce complexity here.
      // eslint-disable-next-line complexity
      test(options) {
        if (!has(options, `body.kmsMessage`)) {
          return Promise.resolve(false);
        }

        if (!isObject(options.body.kmsMessage)) {
          return Promise.resolve(false);
        }

        // If this is a template for a kms message, assume another transform
        // will fill it in later. This is a bit of a leaky abstraction, but the
        // alternative is building a complex rules engine for controlling
        // ordering of transforms
        if (options.body.kmsMessage.keyUris && options.body.kmsMessage.keyUris.length === 0) {
          return Promise.resolve(false);
        }
        if (options.body.kmsMessage.resourceUri && (options.body.kmsMessage.resourceUri.includes(`<KRO>`) || options.body.kmsMessage.resourceUri.includes(`<KEYURL>`))) {
          return Promise.resolve(false);
        }
        if (options.body.kmsMessage.uri && (options.body.kmsMessage.uri.includes(`<KRO>`) || options.body.kmsMessage.uri.includes(`<KEYURL>`))) {
          return Promise.resolve(false);
        }

        return Promise.resolve(true);
      },
      extract(options) {
        return Promise.resolve(options.body);
      }
    }, {
      name: `decryptKmsMessage`,
      direction: `inbound`,
      test(response) {
        return Promise.resolve(has(response, `body.kmsMessage`) && isString(response.body.kmsMessage));
      },
      extract(response) {
        return Promise.resolve(response.body);
      }
    }, {
      name: `decryptErrorResponse`,
      direction: `inbound`,
      test(reason) {
        return Promise.resolve(Boolean(reason.body && reason.body.errorCode === 1900000));
      },
      extract(reason) {
        return Promise.resolve(reason);
      }
    }],
    transforms: [{
      name: `encryptKmsMessage`,
      fn(ctx, object) {
        if (!object) {
          return Promise.resolve();
        }

        if (!object.kmsMessage) {
          return Promise.resolve();
        }

        if (isString(object.kmsMessage)) {
          return Promise.resolve();
        }

        return ctx.spark.encryption.kms.prepareRequest(object.kmsMessage)
          .then((req) => {
            object.kmsMessage = req.wrapped;
          });
      }
    }, {
      name: `decryptKmsMessage`,
      fn(ctx, object) {
        return ctx.spark.encryption.kms.decryptKmsMessage(object.kmsMessage)
          .then((kmsMessage) => {
            object.kmsMessage = kmsMessage;
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
