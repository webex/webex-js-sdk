/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/internal-plugin-mercury';
import '@webex/internal-plugin-encryption';
import '@webex/internal-plugin-conversation';
import '@webex/internal-plugin-feature';

import {registerInternalPlugin} from '@webex/webex-core';
import {has, get} from 'lodash';

import Board from './board';
import RealtimeChannel from './realtime-channel';
import config from './config';

registerInternalPlugin('board', Board, {
  config,
  payloadTransformer: {
    predicates: [
      {
        name: 'decryptContents',
        direction: 'inbound',

        test(ctx, options) {
          // we must have items
          if (!has(options, 'body.items') || options.body.items.length === 0) {
            return Promise.resolve(false);
          }

          // we must have a contentId
          if (!get(options, 'body.items[0].contentId')) {
            return Promise.resolve(false);
          }

          // we must have a encryptionKeyUrl
          /* istanbul ignore if */
          if (!get(options, 'body.items[0].encryptionKeyUrl')) {
            return Promise.resolve(false);
          }

          // we must have a payload or file
          /* istanbul ignore if */
          if (!get(options, 'body.items[0].payload') && !get(options, 'body.items[0].file')) {
            return Promise.resolve(false);
          }

          return Promise.resolve(true);
        },

        extract(options) {
          return Promise.resolve(options.body);
        }
      },
      {
        name: 'encryptChannel',
        direction: 'outbound',

        test(ctx, options) {
          const service = ctx.webex.internal.services.getServiceFromUrl(options.uri);

          if (service && service.name === 'board' && has(options, 'body.aclUrlLink')) {
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
        name: 'decryptContents',
        direction: 'inbound',

        fn(ctx, object) {
          return ctx.webex.internal.board.decryptContents(object)
            .then((decryptedContents) => {
              object.items = decryptedContents;
            });
        }
      },
      {
        name: 'encryptChannel',
        direciton: 'outbound',
        fn(ctx, object) {
          return ctx.webex.internal.encryption.kms.createUnboundKeys({count: 1})
            .then((keys) => {
              const key = keys[0];

              object.defaultEncryptionKeyUrl = key.uri;
              object.kmsMessage.keyUris.push(key.uri);

              return ctx.transform('encryptKmsMessage', object);
            });
        }
      }
    ]
  }
});

export {default} from './board';
export {config};
export {RealtimeChannel};
