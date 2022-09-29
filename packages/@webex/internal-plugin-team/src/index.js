/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/internal-plugin-conversation';
import '@webex/internal-plugin-user';
import '@webex/internal-plugin-encryption';
import {isArray, has, get} from 'lodash';
import {registerInternalPlugin} from '@webex/webex-core';

import Team from './team';
import config from './config';

registerInternalPlugin('team', Team, {
  payloadTransformer: {
    predicates: [
      {
        name: 'decryptTeamRoomStatus',
        direction: 'inbound',
        test(ctx, optionsOrResponse) {
          return Promise.resolve(has(optionsOrResponse, 'activity.object.activityEvent') && get(optionsOrResponse, 'activity.object.objectType') === 'teamRoomStatus');
        },
        extract(optionsOrResponse) {
          return Promise.resolve(optionsOrResponse.activity.object);
        }
      }
    ],
    transforms: [
      {
        name: 'decryptTeam',
        direction: 'inbound',
        fn(ctx, key, team) {
          const promises = [];

          if (team.conversations.items) {
            promises.push(Promise.all(team.conversations.items.map((item) => ctx.transform('decryptObject', null, item))));
          }

          const usableKey = team.encryptionKeyUrl || key;

          if (usableKey) {
            promises.push(ctx.transform('decryptPropDisplayName', usableKey, team));
            promises.push(ctx.transform('decryptPropSummary', usableKey, team));
          }

          return Promise.all(promises);
        }
      },
      {
        name: 'decryptTeamRoomStatus',
        direction: 'inbound',
        fn(ctx, teamRoomStatus) {
          const keyUrl = get(teamRoomStatus, 'activityEvent.encryptionKeyUrl');

          return ctx.transform('decryptObject', keyUrl, teamRoomStatus.activityEvent);
        }
      },
      {
        name: 'decryptPropSummary',
        direction: 'inbound',
        fn(ctx, key, team) {
          return ctx.transform('decryptTextProp', 'summary', key, team);
        }
      },
      {
        name: 'encryptTeam',
        direction: 'outbound',
        fn(ctx, key, team) {
          if (key === false) {
            return Promise.resolve();
          }

          return Promise.resolve(key || ctx.webex.internal.encryption.kms.createUnboundKeys({count: 1}))
            .then((keys) => {
              const k = isArray(keys) ? keys[0] : keys;

              if (team.kmsMessage && team.kmsMessage.keyUris && !team.kmsMessage.keyUris.includes(k.uri)) {
                team.kmsMessage.keyUris.push(k.uri);
              }

              return Promise.all([
                ctx.transform('encryptPropDisplayName', k, team),
                ctx.transform('encryptPropSummary', k, team)
              ])
                .then(() => {
                  team.encryptionKeyUrl = k.uri || k;

                  // we only want to set the defaultActivityEncryptionKeyUrl if we've
                  // bound a new key
                  if (!key) {
                    team.defaultActivityEncryptionKeyUrl = team.defaultActivityEncryptionKeyUrl || k.uri || k;
                  }
                });
            });
        }
      },
      {
        name: 'encryptPropSummary',
        direction: 'outbound',
        fn(ctx, key, team) {
          return ctx.transform('encryptTextProp', 'summary', key, team);
        }
      },
      {
        name: 'normalizeTeam',
        fn(ctx, team) {
          team.conversations = team.conversations || {};
          team.conversations.items = team.conversations.items || [];
          team.teamMembers = team.teamMembers || {};
          team.teamMembers.items = team.teamMembers.items || [];

          return Promise.all([
            Promise.all(team.conversations.items.map((item) => ctx.transform('normalizeObject', item))),
            Promise.all(team.teamMembers.items.map((item) => ctx.transform('normalizeObject', item)))
          ]);
        }
      }
    ]
  },
  config
});

export {default} from './team';
