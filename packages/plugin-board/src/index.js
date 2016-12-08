/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import '@ciscospark/plugin-mercury';
import '@ciscospark/plugin-encryption';
import '@ciscospark/plugin-conversation';

import {registerPlugin} from '@ciscospark/spark-core';
import Board from './board';
import config from './config';
import {has, get} from 'lodash';

registerPlugin(`board`, Board, {
  config,
  payloadTransformer: {
    predicates: [
      {
        name: `decryptContents`,
        direction: `inbound`,

        test(ctx, options) {
          // we must have items
          if (!has(options, `body.items`) || options.body.items.length === 0) {
            return Promise.resolve(false);
          }

          // we must have a contentId
          if (!get(options, `body.items[0].contentId`)) {
            return Promise.resolve(false);
          }

          // we must have a encryptionKeyUrl
          /* istanbul ignore if */
          if (!get(options, `body.items[0].encryptionKeyUrl`)) {
            return Promise.resolve(false);
          }

          // we must have a payload
          /* istanbul ignore if */
          if (!get(options, `body.items[0].payload`)) {
            return Promise.resolve(false);
          }
          return Promise.resolve(true);
        },

        extract(options) {
          return Promise.resolve(options.body);
        }
      },
      {
        name: `encryptChannel`,
        direction: `outbound`,

        test(ctx, options) {
          if (ctx.spark.device.isSpecificService(`board`, options.uri) && has(options, `body.aclUrlLink`)) {
            return Promise.resolve(true);
          }
          return Promise.resolve(false);
        },

        extract(options) {
          return Promise.resolve(options.body);
        }
      }
    ],
    transforms: [
      {
        name: `decryptContents`,
        direction: `inbound`,

        fn(ctx, object) {
          return ctx.spark.board.decryptContents(object)
            .then((decryptedContents) => {
              object.items = decryptedContents;
            });
        }
      },
      {
        name: `encryptChannel`,
        direciton: `outbound`,
        fn(ctx, object) {
          return ctx.spark.encryption.kms.createUnboundKeys({count: 1})
            .then((keys) => {
              const key = keys[0];
              object.defaultEncryptionKeyUrl = key.uri;
              object.kmsMessage.keyUris.push(key.uri);
              return ctx.transform(`encryptKmsMessage`, object);
            });
        }
      }
    ]
  }
});

export {default as default} from './board';
export {config as config};
