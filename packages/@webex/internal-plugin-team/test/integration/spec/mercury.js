/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/internal-plugin-device';
import '@webex/internal-plugin-team';

import {assert} from '@webex/test-helper-chai';
import WebexCore from '@webex/webex-core';
import {expectActivity} from '@webex/test-helper-mocha';
import {get} from 'lodash';
import testUsers from '@webex/test-helper-test-users';
import uuid from 'uuid';

describe('plugin-team', () => {
  describe('Team', () => {
    let kirk, spock;

    before('create users', () => testUsers.create({count: 2})
      .then((users) => {
        [kirk, spock] = users;

        kirk.webex = new WebexCore({
          credentials: {
            authorization: kirk.token
          },
          config: {
            conversation: {
              keepEncryptedProperties: true
            }
          }
        });

        spock.webex = new WebexCore({
          credentials: {
            authorization: spock.token
          },
          config: {
            conversation: {
              keepEncryptedProperties: true
            }
          }
        });

        return Promise.all([
          kirk.webex.internal.mercury.connect(),
          spock.webex.internal.mercury.connect()
        ]);
      }));

    after(() => Promise.all([
      kirk && kirk.webex.internal.mercury.disconnect(),
      spock && spock.webex.internal.mercury.disconnect()
    ]));

    describe('when mercury event is received', () => {
      let teamConvo, team;

      before('create team', () => kirk.webex.internal.team.create({
        displayName: `team-${uuid.v4()}`,
        participants: [
          kirk,
          spock
        ]
      })
        .then((t) => {
          team = t;
        }));

      before('create team conversation', () => kirk.webex.internal.team.createConversation(team, {
        displayName: `team-conversation-${uuid.v4()}`,
        participants: [
          kirk
        ]
      })
        .then((c) => {
          teamConvo = c;
        }));

      it('updates the displayName of an unjoined team convo', () => {
        const update = {
          displayName: `updated-team-convo--${uuid.v4()}`,
          objectType: 'conversation'
        };

        const activityChecker = (activity) => activity.verb === 'update' && get(activity, 'object.objectType') === 'teamRoomStatus';

        return Promise.all([
          expectActivity(20000, 'event:conversation.activity', spock.webex.internal.mercury, activityChecker, 'teamRoomStatus update expected'),
          kirk.webex.internal.team.update(teamConvo, update)
        ])
          .then(([activity]) => {
            assert.equal(activity.object.activityEvent.object.displayName, update.displayName);
          });
      });
    });
  });
});
