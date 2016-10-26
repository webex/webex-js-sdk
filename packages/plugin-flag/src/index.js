/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {registerPlugin} from '@ciscospark/spark-core';
import Flag from './flag';
import config from './config';
import '@ciscospark/plugin-wdm';
import {has} from 'lodash';

registerPlugin(`flag`, Flag, {
  config,
  payloadTransformer: {
    predicates: [
      {
        name: `transformObjectArray`,
        direction: `inbound`,
        test(ctx, response) {
          return Promise.resolve(has(response, `body.multistatus`));
        },
        extract(response) {
          return Promise.resolve(response.body.multistatus.map((item) => item.data.activity));
        }
      }
    ],
    transforms: []
  }
});

export {default as default} from './flag';
