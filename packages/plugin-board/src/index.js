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
          if (!get(options, `body.items[0].encryptionKeyUrl`)) {
            return Promise.resolve(false);
          }

          // we must have a payload
          if (!get(options, `body.items[0].payload`)) {
            return Promise.resolve(false);
          }
          return Promise.resolve(true);
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
      }
    ]
  }
});

export {default as default} from './board';
export {config as config};
