/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/internal-plugin-device';

import {registerPlugin} from '@webex/webex-core';
import {has} from 'lodash';

import Presence from './presence';
import config from './config';
import {IPredicate, IResponse, ITransform} from './interface';

registerPlugin('presence', Presence, {
  payloadTransformer: {
    predicates: [
      {
        name: 'normalizeSingleStatusResponse',
        direction: 'inbound',
        test(ctx, response: IResponse) {
          // POST to /apheleia/api/v1/events
          return Promise.resolve(has(response, 'body.eventType') && has(response, 'body.subject'));
        },
        extract(response: IResponse) {
          return Promise.resolve(response);
        },
      },
    ] as IPredicate[],
    transforms: [
      {
        name: 'normalizeSingleStatusResponse',
        direction: 'inbound',
        fn(ctx, response: IResponse) {
          response.body.status = response.body.eventType;
        },
      },
    ] as ITransform[],
  },
  config,
});

export default Presence;
