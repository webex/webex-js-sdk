/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import '@ciscospark/plugin-wdm';
import '@ciscospark/plugin-encryption';
import '@ciscospark/plugin-conversation';

import {registerPlugin} from '@ciscospark/spark-core';
import Calendar from './calendar';
import config from './config';
import {has} from 'lodash';

registerPlugin(`calendar`, Calendar, {
  config,
  payloadTransformer: {
    predicates: [
      {
        name: `transformMeetingArray`,
        direction: `inbound`,
        test(ctx, response) {
          return Promise.resolve(has(response, `body.items[0].seriesId`));
        },
        extract(response) {
          return Promise.resolve(response.body.items);
        }
      },
      {
        name: `transformMeeting`,
        direction: `inbound`,
        test(ctx, response) {
          return Promise.resolve(has(response, `body.seriesId`));
        },
        extract(response) {
          return Promise.resolve(response.body);
        }
      }
    ],
    transforms: [
      {
        name: `transformMeetingArray`,
        fn(ctx, array) {
          return Promise.all(array.map((item) => ctx.transform(`transformMeeting`, item)));
        }
      },
      {
        name: `transformMeeting`,
        direction: `inbound`,
        fn(ctx, object) {
          if (!object) {
            return Promise.resolve();
          }

          if (!object.encryptionKeyUrl) {
            return Promise.resolve();
          }

          return Promise.all([
            ctx.transform(`decryptTextProp`, `encryptedSubject`, object.encryptionKeyUrl, object),
            ctx.transform(`decryptTextProp`, `encryptedLocation`, object.encryptionKeyUrl, object),
            ctx.transform(`decryptTextProp`, `encryptedNotes`, object.encryptionKeyUrl, object)
          ]);
        }
      }
    ]
  }
});

export {default as default} from './calendar';
