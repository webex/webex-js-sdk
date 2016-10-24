/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {registerPlugin} from '@ciscospark/spark-core';
import Search from './search';
import config from './config';
import {has} from 'lodash';

import '@ciscospark/plugin-encryption';

registerPlugin(`search`, Search, {
  config,
  payloadTransformer: {
    predicates: [
      {
        name: `encryptSearchQuery`,
        direction: `outbound`,
        test(ctx, options) {
          if (!has(options, `body.query`)) {
            return Promise.resolve(false);
          }

          if (!has(options, `body.searchEncryptionKeyUrl`)) {
            return Promise.resolve(false);
          }

          return ctx.spark.device.isSpecificService(`argonaut`, options.service || options.url);
        },
        extract(options) {
          return Promise.resolve(options.body);
        }
      },
      {
        name: `transformObjectArray`,
        direction: `inbound`,
        test(ctx, response) {
          return Promise.resolve(has(response, `body.activities.items`));
        },
        extract(response) {
          return Promise.resolve(response.body.activities.items);
        }
      }
    ],
    transforms: [
      {
        name: `encryptSearchQuery`,
        direction: `outbound`,
        fn(ctx, object) {
          return ctx.spark.encryption.encryptText(object.searchEncryptionKeyUrl, object.query)
            .then((q) => {
              object.query = q;
            });
        }
      }
    ]
  }
});

export {default as default} from './search';
