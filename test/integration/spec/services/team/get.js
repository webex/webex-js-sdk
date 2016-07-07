/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var assert = require('chai').assert;
var every = require('lodash.every');
var find = require('lodash.find');
var landingparty = require('../../../lib/landingparty');
var patterns = require('../../../../../src/util/patterns');
var uuid = require('uuid');

describe('Services', function() {
  describe('Team', function() {
    describe('Retrieval', function() {
      this.timeout(60000);

      var party = {
        uhura: true,
        scotty: true
      };

      function ensureGeneral(conversations) {
        assert(find(conversations, function(conversation) {
          return conversation.tags.indexOf('LOCKED') > -1 && conversation.tags.indexOf('TEAM') > -1;
        }));
      }

      before(function beamDown() {
        return landingparty.beamDown(party);
      });

      var team0;
      var team1;

      before(function() {
        team0 = {
          displayName: 'test-team-0',
          participants: [
            party.uhura.id,
            party.scotty.id
          ]
        };

        team1 = {
          displayName: 'test-team-1',
          participants: [
            party.uhura.id,
            party.scotty.id
          ]
        };
        return Promise.all([
          party.uhura.spark.team.create(team0),
          party.uhura.spark.team.create(team1)
        ])
          .then(function(teams) {
            team0 = teams[0];
            team1 = teams[1];

            var emptyRoom = {
              displayName: 'team-conversation-' + uuid.v4(),
              participants: [
                party.uhura.id
              ]
            };

            return Promise.all([
              party.uhura.spark.team.createConversation(teams[0], emptyRoom),
              party.uhura.spark.team.createConversation(teams[0], emptyRoom)
            ]);
          });
      });

      describe('#get()', function() {
        describe('Single team', function() {
          it('retrieves team', function() {
            return party.uhura.spark.team.get(team0)
              .then(function(team) {
                assert.equal(team.id, team0.id);
                assert.equal(team.objectType, 'team');
                assert.match(team.teamColor, patterns.hexColorCode);
                assert.equal(team.displayName, team0.displayName);
                assert.equal(team.teamMembers.items.length, 0);
                assert.equal(team.conversations.items.length, 0);
              });
          });

          it('retrieves team with teamMembers', function() {
            return party.uhura.spark.team.get({
              id: team0.id,
              includeTeamMembers: true
            })
              .then(function(team) {
                assert.equal(team.id, team0.id);
                assert.equal(team.displayName, team0.displayName);
                assert.equal(team.teamMembers.items.length, 2);
                assert.equal(team.conversations.items.length, 0);
              });
          });

          it('retrieves team with conversations', function() {
            return party.uhura.spark.team.get({
              id: team0.id,
              includeTeamConversations: true
            })
              .then(function(team) {
                assert.equal(team.id, team0.id);
                assert.equal(team.displayName, team0.displayName);
                assert.equal(team.teamMembers.items.length, 0);
                // Note we get the general conversation back in addition to the 2 added rooms
                assert.equal(team.conversations.items.length, 3);
              });
          });
        });

        describe('Multiple teams', function() {
          it('retrieves teams', function() {
            return party.uhura.spark.team.get()
              .then(function(teams) {
                assert.equal(teams.length, 2);

                // Ensure team conversations and team members aren't included
                var excludesConvosAndMembers = every(teams, function(team) {
                  return team.teamMembers.items.length === 0 && team.conversations.items.length === 0;
                });

                assert(excludesConvosAndMembers);
              });
          });

          it('retrieves teams with teamMembers', function() {
            return party.uhura.spark.team.get({
              includeTeamMembers: true
            })
              .then(function(teams) {
                assert.equal(teams.length, 2);
                assert.equal(teams.length, 2);

                // Ensure team conversations and team members aren't included
                var excludesConvos = every(teams, function(team) {
                  return team.teamMembers.items.length !== 0 && team.conversations.items.length === 0;
                });

                assert(excludesConvos);
              });
          });

          it('retrieves teams with conversations', function() {
            return party.uhura.spark.team.get({
              includeTeamConversations: true
            })
              .then(function(teams) {
                assert.equal(teams.length, 2);

                var teamWithConvos = find(teams, {id: team0.id});
                // Note we get the general conversation back in addition to the 2 added rooms
                assert.equal(teamWithConvos.conversations.items.length, 3);
                ensureGeneral(teamWithConvos.conversations.items);
              });
          });
        });
      });

      describe('#getConversations()', function() {
        it('retrieves conversations for a team', function() {
          return party.uhura.spark.team.getConversations(team0)
            .then(function(teamConvos) {
              // Note we get the general conversation back in addition to the 2 added rooms
              assert.equal(teamConvos.length, 3);
              ensureGeneral(teamConvos);
            });
        });
      });
    });
  });
});
