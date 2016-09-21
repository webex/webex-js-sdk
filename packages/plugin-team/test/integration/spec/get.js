/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import '../..';
import '@ciscospark/plugin-conversation';
import {assert} from '@ciscospark/test-helper-chai';
import CiscoSpark from '@ciscospark/spark-core';
import {every, find} from 'lodash';
import testUsers from '@ciscospark/test-helper-test-users';
import uuid from 'uuid';

function ensureGeneral(conversations) {
  assert(find(conversations, (conversation) => {
    return conversation.tags.contains(`LOCKED`) && conversation.tags.contains(`TEAM`);
  }));
}

describe(`plugin-team`, function() {

  let kirk, spark, spock, team0, team1, uhura;

  before(() => testUsers.create({count: 2})
    .then((users) => {
      [kirk, spock, uhura] = users;

      kirk.spark = spark = new CiscoSpark({
        credentials: {
          authorization: kirk.token
        }
      });

      return spark.mercury.connect();
    })
  );

  before(() => {
    team0 = {
      displayName: `test-team-0`,
      summary: `test-team-0-summary`,
      participants: [
        kirk,
        spock
      ]
    };

    team1 = {
      displayName: `test-team-1`,
      participants: [
        kirk
      ]
    };

    return Promise.all([
      spark.team.create(team0),
      spark.team.create(team1)
    ])
      .then((teams) => {
        team0 = teams[0];
        team1 = teams[1];

        const emptyRoom = {
          displayName: `team-conversation-${uuid.v4()}`,
          participants: [
            kirk
          ]
        };

        return Promise.all([
          spark.team.createConversation(team0, emptyRoom),
          spark.team.createConversation(team0, emptyRoom)
        ]);
      });
  });

  describe(`#get()`, () => {
    it(`retrieves a team`, () => spark.get(team0)
      .then((t) => {
        assert.isInternalTeam(t);
        assert.equal(t.id, team0.id);
        assert.match(t.teamColor, team0.teamColor);
        assert.equal(t.displayName, team0.displayName);
        assert.equal(t.summary, team0.summary);
        assert.lengthOf(t.teamMembers.items, 0);
        assert.lengthOf(t.conversations.items, 0);
      })
    );

    it(`retrieves a team with teamMembers`, () => spark.team.get(team0, {includeTeamMembers: true})
      .then((t) => {
        assert.isInternalTeam(t);
        assert.equal(t.id, team0.id);
        assert.lengthOf(t.teamMembers.items, team0.teamMembers.items.length);
        assert.lengthOf(t.conversations.items, 0);
      })
    );

    it(`retrieves a team with conversations`, () => spark.team.get(team0, {includeTeamMembers: true})
      .then((t) => {
        assert.isInternalTeam(t);
        assert.equal(t.id, team0.id);
        assert.lengthOf(t.teamMembers.items, 0);
        // Note we get the general conversation back in addition to the 2 added rooms
        assert.lengthOf(t.conversations.items, 3);
        ensureGeneral(t.conversations.items);
      })
    );
  });

  describe(`#getConversations()`, () => {
    it(`retrieves conversations for a team`, () => spark.team.getConversations(team0)
      .then((conversations) => {
        assert.lengthOf(conversations, 3);
        ensureGeneral(conversations);
      })
    );
  });

  describe(`#list()`, () => {
    it(`retrieves a list of teams`, () => spark.teams.list()
      .then((teams) => {
        assert.equal(teams.length, 2);

        every(teams, (team) => {
          assert.lengthOf(team.teamMembers.items, 0);
          assert.lengthOf(team.conversations.items, 0);
        });
      })
    );

    it(`retrieves a list of teams with teamMembers`, () => spark.teams.list({includeTeamMembers: true})
      .then((teams) => {
        assert.equal(teams.length, 2);

        every(teams, (team) => {
          assert.isAbove(team.teamMembers.items, 0);
          assert.lengthOf(team.conversations.items, 0);
        });
      })
    );

    it(`retrieves a list of teams with conversations`, () => spark.teams.list()
      .then((teams) => {
        assert.equal(teams.length, 2);

        every(teams, (team) => {
          assert.lengthOf(team.teamMembers.items, 0);
          assert.isAbove(team.conversations.items, 0);
          ensureGeneral(team.conversations.items);
        });
      })
    );
  });
});
