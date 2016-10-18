/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import '../..';
import '@ciscospark/plugin-wdm';

import {assert} from '@ciscospark/test-helper-chai';
import CiscoSpark from '@ciscospark/spark-core';
import {find, findLast} from 'lodash';
import testUsers from '@ciscospark/test-helper-test-users';
import uuid from 'uuid';

describe(`plugin-team`, () => {

  let kirk, participants, spark, spock, team;

  before(() => testUsers.create({count: 3})
    .then((users) => {
      participants = [kirk, spock] = users;

      spark = new CiscoSpark({
        credentials: {
          authorization: kirk.token
        },
        config: {
          conversation: {
            keepEncryptedProperties: true
          }
        }
      });

      return spark.mercury.connect();
    })
  );

  after(() => spark.mercury.disconnect());

  describe(`#create()`, () => {

    it(`creates a team with a multiple participants`, () => {
      const displayName = `team-name-${uuid.v4()}`;
      return spark.team.create({
        displayName,
        participants: [kirk, spock]
      })
        .then((team) => {
          assert.isInternalTeam(team);
          assert.isNewEncryptedTeam(team);
          assert.lengthOf(team.teamMembers.items, 2);

          // Kirk created the team and is the moderator, Spock is not.
          const kirkEntry = find(team.teamMembers.items, {id: kirk.id});
          assert.isDefined(kirkEntry);
          assert.isDefined(kirkEntry.roomProperties.isModerator);

          const spockEntry = find(team.teamMembers.items, {id: spock.id});
          assert.isDefined(spockEntry);
          assert.isUndefined(spockEntry.roomProperties);
        });
    });

    it(`creates a team with a name and summary`, () => {
      const displayName = `team-name-${uuid.v4()}`;
      const summary = `team-summary-${uuid.v4()}`;
      return spark.team.create({
        displayName,
        summary,
        participants: [kirk]
      })
        .then((team) => {
          assert.isInternalTeam(team);
          assert.isNewEncryptedTeam(team);
          assert.lengthOf(team.teamMembers.items, 1);

          assert.equal(team.displayName, displayName);
          assert.equal(team.summary, summary);
        });
    });

    it(`creates a team with a name but without a summary`, () => {
      const displayName = `team-name-${uuid.v4()}`;
      return spark.team.create({
        displayName,
        participants: [kirk]
      })
        .then((team) => {
          assert.isInternalTeam(team);
          assert.isNewEncryptedTeam(team);
          assert.lengthOf(team.teamMembers.items, 1);

          assert.equal(team.displayName, displayName);
          assert.isUndefined(team.summary);
        });
    });
  });

  describe(`#createConversation()`, () => {

    before(() => {
      const displayName = `team-name-${uuid.v4()}`;
      return spark.team.create({
        displayName,
        participants
      })
      .then((t) => {
        team = t;
      });
    });

    it(`creates a team conversation with a single participant`, () => {
      const displayName = `team-conv-name-${uuid.v4()}`;
      return spark.team.createConversation(team, {
        displayName,
        participants: [kirk]
      })
        .then((tc) => {
          assert.isInternalTeamConversation(tc);
          assert.equal(tc.displayName, displayName);

          assert.lengthOf(tc.participants.items, 1);
        });
    });

    it(`creates a team conversation with multiple participants`, () => {
      const displayName = `team-conv-name-${uuid.v4()}`;
      return spark.team.createConversation(team, {
        displayName,
        participants: [kirk, spock]
      })
        .then((tc) => {
          assert.isInternalTeamConversation(tc);
          assert.lengthOf(tc.participants.items, 2);
        });
    });

    it(`creates a team conversation containing all team members via \`includeAllTeamMembers\` parameter`, () => {
      const displayName = `team-conv-name-${uuid.v4()}`;
      return spark.team.createConversation(team, {
        displayName,
        participants: [kirk]
      }, {
        includeAllTeamMembers: true
      })
        .then((tc) => {
          assert.isInternalTeamConversation(tc);
          assert.lengthOf(tc.participants.items, 3);
        });
    });

    it(`decrypts the 'add' activity appended to the general conversation after team room is created`, () => {
      const displayName = `team-conv-name-${uuid.v4()}`;
      return spark.team.createConversation(team, {
        displayName,
        participants: [kirk]
      }, {
        includeAllTeamMembers: true
      })
        .then((tc) => spark.conversation.get({
          id: team.generalConversationUuid
        }, {
          activitiesLimit: 10
        })
        .then((teamGeneral) => {
          assert.isConversation(teamGeneral);
          const addActivity = findLast(teamGeneral.activities.items, (activity) => {
            return activity.verb === `add` && activity.object.objectType === `conversation` && activity.object.id === tc.id;
          });

          assert.isDefined(addActivity);
          assert.equal(addActivity.object.displayName, tc.displayName);

          assert.isDefined(addActivity.object.encryptedDisplayName);
          assert.notEqual(addActivity.object.displayName, addActivity.object.encryptedDisplayName);
          assert.equal(addActivity.object.displayName, displayName);
        })
      );
    });
  });

});
