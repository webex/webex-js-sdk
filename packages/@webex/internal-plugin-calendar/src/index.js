/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/internal-plugin-device';
import '@webex/internal-plugin-encryption';
import '@webex/internal-plugin-conversation';

import {registerInternalPlugin} from '@webex/webex-core';
import {has} from 'lodash';

import Calendar from './calendar';
import config from './config';

registerInternalPlugin('calendar', Calendar, {
  config,
  payloadTransformer: {
    predicates: [
      {
        name: 'transformMeetingNotes',
        direction: 'inbound',
        test(ctx, response) {
          return Promise.resolve(has(response, 'body.encryptedNotes'));
        },
        extract(response) {
          return Promise.resolve(response.body);
        }
      },
      {
        name: 'transformMeetingParticipants',
        direction: 'inbound',
        test(ctx, response) {
          return Promise.resolve(has(response, 'body.encryptedParticipants'));
        },
        extract(response) {
          return Promise.resolve(response.body);
        }
      },
      {
        name: 'transformMeetingArray',
        direction: 'inbound',
        test(ctx, response) {
          return Promise.resolve(has(response, 'body.items[0].seriesId'));
        },
        extract(response) {
          return Promise.resolve(response.body.items);
        }
      },
      {
        name: 'transformMeeting',
        direction: 'inbound',
        test(ctx, response) {
          return Promise.resolve(has(response, 'body.seriesId'));
        },
        extract(response) {
          return Promise.resolve(response.body);
        }
      },
      {
        name: 'transformMeeting',
        direction: 'inbound',
        test(ctx, response) {
          return Promise.resolve(has(response, 'calendarMeetingExternal'));
        },
        extract(response) {
          return Promise.resolve(response.calendarMeetingExternal);
        }
      }
    ],
    transforms: [
      {
        name: 'transformMeetingArray',
        fn(ctx, array) {
          return Promise.all(array.map((item) => ctx.transform('transformMeeting', item)));
        }
      },
      {
        name: 'transformMeeting',
        direction: 'inbound',
        fn(ctx, object) {
          if (!object) {
            return Promise.resolve();
          }

          if (!object.encryptionKeyUrl) {
            return Promise.resolve();
          }

          // Decrypt participant properties if meeting object contains participants
          const decryptedParticipants = object.encryptedParticipants ? object.encryptedParticipants.map((participant) => Promise.all([
            ctx.transform('decryptTextProp', 'encryptedEmailAddress', object.encryptionKeyUrl, participant),
            ctx.transform('decryptTextProp', 'encryptedName', object.encryptionKeyUrl, participant)
          ])) : [];

          // Decrypt meetingJoinInfo properties if meeting object contains meetingJoinInfo
          const decryptedMeetingJoinInfo = object.meetingJoinInfo ? Promise.all([
            ctx.transform('decryptTextProp', 'meetingJoinURI', object.encryptionKeyUrl, object.meetingJoinInfo),
            ctx.transform('decryptTextProp', 'meetingJoinURL', object.encryptionKeyUrl, object.meetingJoinInfo)
          ]) : [];

          const decryptedOrganizer = object.encryptedOrganizer ? Promise.all([
            ctx.transform('decryptTextProp', 'encryptedEmailAddress', object.encryptionKeyUrl, object.encryptedOrganizer),
            ctx.transform('decryptTextProp', 'encryptedName', object.encryptionKeyUrl, object.encryptedOrganizer)
          ]) : [];

          return Promise.all([
            ctx.transform('decryptTextProp', 'encryptedSubject', object.encryptionKeyUrl, object),
            ctx.transform('decryptTextProp', 'encryptedLocation', object.encryptionKeyUrl, object),
            ctx.transform('decryptTextProp', 'encryptedNotes', object.encryptionKeyUrl, object),
            ctx.transform('decryptTextProp', 'webexURI', object.encryptionKeyUrl, object),
            ctx.transform('decryptTextProp', 'webexURL', object.encryptionKeyUrl, object),
            ctx.transform('decryptTextProp', 'spaceMeetURL', object.encryptionKeyUrl, object),
            ctx.transform('decryptTextProp', 'spaceURI', object.encryptionKeyUrl, object),
            ctx.transform('decryptTextProp', 'spaceURL', object.encryptionKeyUrl, object)
          ].concat(decryptedOrganizer, decryptedParticipants, decryptedMeetingJoinInfo));
        }
      },
      {
        name: 'transformMeetingNotes',
        direction: 'inbound',
        fn(ctx, object) {
          if (!object) {
            return Promise.resolve();
          }

          if (!object.encryptionKeyUrl) {
            return Promise.resolve();
          }

          return Promise.all([
            ctx.transform('decryptTextProp', 'encryptedNotes', object.encryptionKeyUrl, object)
          ]);
        }
      },
      {
        name: 'transformMeetingParticipants',
        direction: 'inbound',
        fn(ctx, object) {
          if (!object) {
            return Promise.resolve();
          }

          if (!object.encryptionKeyUrl || !object.encryptedParticipants) {
            return Promise.resolve();
          }

          // Decrypt participant properties
          const decryptedParticipants = object.encryptedParticipants.map((participant) => Promise.all([
            ctx.transform('decryptTextProp', 'encryptedEmailAddress', object.encryptionKeyUrl, participant),
            ctx.transform('decryptTextProp', 'encryptedName', object.encryptionKeyUrl, participant)
          ]));

          return Promise.all(decryptedParticipants);
        }
      }
    ]
  }
});

export {default} from './calendar';
