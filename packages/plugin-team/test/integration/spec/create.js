/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import '../..';
import {assert} from '@ciscospark/test-helper-chai';
import CiscoSpark from '@ciscospark/spark-core';
import {find} from 'lodash';
import testUsers from '@ciscospark/test-helper-test-users';
import uuid from 'uuid';

describe(`plugin-team`, function() {

  let kirk, spock, uhura, participants, spark;

  before(() => testUsers.create({count: 3})
    .then((users) => {
      participants = [kirk, spock, uhura] = users;

      spark = new CiscoSpark({
        credentials: {
          authorization: kirk.token
        }
      });

      return spark.mercury.connect();
    })
  );

  after(() => spark.mercury.disconnect());

  describe(`#create()`, () => {

    it(`creates a team with a multiple participants`, () => {
      return spark.team.create({
        participants: [kirk, spock]
      })
        .then((team) => {
          assert.isInternalTeam(team);
          assert.isNewEncryptedTeam(team);
          assert.lengthOf(team.teamMembers.items, 2);

          const kirkEntry = find(team.teamMembers.items, {id: kirk.id});
          assert.isDefined(kirkEntry);
          assert.isDefined(kirkEntry.roomProperties.isModerator);
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
          assert.isTeam(team);
          assert.isNewEncryptedTeam(team);
          assert.lengthOf(team.teamMembers.items, 1);

          assert.equal(team.displayName, displayName);
          assert.isUndefined(team.summary);
        })
    });
  });

  describe(`#createConversation()`, () => {
    const team;

    before(() => {
      team = spark.team.create({
        participants: [kirk, spock, uhura]
      })
    );

    it(`creates a team conversation with a single participant`, () => {
      return spark.team.createConversation({
        participants: [kirk]
      })
        .then((tc) => {
          assert.isInternalTeamConversation(tc);
          assert.lengthOf(tc.participants.items, 1);
        });
    });

    it(`creates a team conversation with multiple participants`, () => {
      return spark.team.createConversation({
        participants: [kirk, spock]
      })
        .then((tc) => {
          assert.isInternalTeamConversation(tc);
          assert.lengthOf(tc.participants.items, 2);
        });
    });

    it(`creates a team using the 'includeAllTeamMembers' parameter`, () => {
      return spark.team.createConversation({
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
      return spark.team.createConversation({
        participants: [kirk]
      }, {
        includeAllTeamMembers: true
      })
        .then((tc) => spark.conversation.get({
            id: team.generalConversationUuid,
            activitiesLimit: 10
          })
            .then(function(teamGeneral) {
              assert.isInternalConversation(teamGeneral);
              var addActivity = findLast(teamGeneral.activities.items, function(activity) {
                return activity.verb === 'add' && activity.object.objectType === 'conversation' && activity.object.id === tc.id;
              });

              assert.isDefined(addActivity);
              assert.equal(addActivity.object.displayName, tc.displayName);
            });
        });
    });
  });

});
