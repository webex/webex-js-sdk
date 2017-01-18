/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var assert = require('chai').assert;
var find = require('lodash.find');
var findLast = require('lodash.findlast');
var landingparty = require('../../../lib/landingparty');
var patterns = require('../../../../../src/util/patterns');
var uuid = require('uuid');

describe('Services', function() {
  describe('Team', function() {
    describe('Actions', function() {
      this.timeout(60000);

      var party = {
        scotty: true,
        kirk: true
      };

      before(function beamDown() {
        return landingparty.beamDown(party);
      });

      describe('#create()', function() {
        it('creates a team with a name and summary', function() {
          var teamName = 'team-' + uuid.v4();
          var teamSummary = teamName + '-summary';
          return party.kirk.spark.team.create({
            displayName: teamName,
            summary: teamSummary,
            participants: [
              party.kirk.id,
              party.scotty.id
            ]
          })
            .then(function(team) {
              assert.isDefined(team);
              assert.equal(team.objectType, 'team');
              assert.equal(team.displayName, teamName);
              assert.equal(team.summary, teamSummary);
              assert.match(team.teamColor, patterns.hexColorCode);
              assert.isDefined(team.teamMembers);
              assert.isDefined(team.teamMembers.items);
              assert.equal(team.teamMembers.items.length, 2);

              // Assert the creator is a moderator.
              var kirkEntry = find(team.teamMembers.items, {id: party.kirk.id});
              assert.isDefined(kirkEntry);
              assert.isDefined(kirkEntry.roomProperties.isModerator);
            });
        });

        it('creates a team with a name but no summary', function() {
          var teamName = 'team-' + uuid.v4();
          return party.kirk.spark.team.create({
            displayName: teamName,
            participants: [
              party.kirk.id
            ]
          })
            .then(function(team) {
              assert.equal(team.displayName, teamName);
              assert.isUndefined(team.summary);

              assert.isDefined(team.teamMembers);
              assert.isDefined(team.teamMembers.items);
              assert.equal(team.teamMembers.items.length, 1);
            });
        });
      });

      describe('#addMember()', function() {
        var team;
        var additionalConversation;
        before(function() {
          return party.kirk.spark.team.create({
            displayName: 'team-' + uuid.v4(),
            participants: [
              party.kirk.id
            ]
          })
            .then(function(res) {
              team = res;

              return party.kirk.spark.team.createConversation(team, {
                displayName: 'team-conversation-' + uuid.v4(),
                participants: [
                  party.kirk.id
                ]
              })
                .then(function(conversation) {
                  additionalConversation = conversation;
                });
            });
        });

        it('adds a team member to a team', function() {
          return party.kirk.spark.team.addMember(team, {id: party.scotty.id})
            .then(function() {
              return party.kirk.spark.team.get({
                id: team.id,
                includeTeamMembers: true
              });
            })
            .then(function(team) {
              assert.isDefined(find(team.teamMembers.items, {id: party.scotty.id}));

              // Assert scotty can decrypt team and its rooms
              return party.scotty.spark.team.get({
                id: team.id,
                includeTeamConversations: true
              })
                .then(function(scottyTeam) {
                  assert.isDefined(scottyTeam);
                  assert.equal(scottyTeam.displayName, team.displayName);
                  assert.equal(scottyTeam.conversations.items.length, 2);

                  var scottyAddtlConversation = find(scottyTeam.conversations.items, {id: additionalConversation.id});
                  assert.isDefined(scottyAddtlConversation);
                  assert.equal(scottyAddtlConversation.displayName, additionalConversation.displayName);
                  assert.isAbove(scottyAddtlConversation.tags.indexOf('NOT_JOINED'), -1);
                });
            });
        });
      });

      describe('#removeMember()', function() {
        var team;

        before(function() {
          return party.kirk.spark.team.create({
            displayName: 'team-' + uuid.v4(),
            participants: [
              party.kirk.id,
              party.scotty.id
            ]
          })
            .then(function(res) {
              team = res;
            });
        });

        it('removes a team member from a team', function() {
          return party.kirk.spark.team.removeMember(team, {id: party.scotty.id})
            .then(function() {
              return party.kirk.spark.team.get({
                id: team.id,
                includeTeamMembers: true
              });
            })
            .then(function(team) {
              assert.equal(team.teamMembers.items.length, 1);
              assert.equal(team.teamMembers.items[0].id, party.kirk.id);
            });
        });
      });

      describe('#assignModerator()', function() {
        var team;
        before(function() {
          return party.kirk.spark.team.create({
            displayName: 'team-' + uuid.v4(),
            participants: [
              party.kirk.id,
              party.scotty.id
            ]
          })
            .then(function(res) {
              team = res;
            });
        });

        it('assigns a team member moderator role for the team', function() {
          return party.kirk.spark.team.assignModerator(team, party.scotty)
            .then(function() {
              return party.kirk.spark.team.get({
                id: team.id,
                includeTeamMembers: true
              });
            })
            .then(function(team) {
              assert.equal(team.teamMembers.items.length, 2);
              team.teamMembers.items.forEach(function(member) {
                assert.isDefined(member.roomProperties.isModerator);
              });
            });
        });
      });

      describe('#unassignModerator()', function() {
        var team;
        before(function() {
          return party.kirk.spark.team.create({
            displayName: 'team' + uuid.v4(),
            participants: [
              party.kirk.id,
              party.scotty.id
            ]
          })
            .then(function(res) {
              team = res;
              return party.kirk.spark.team.assignModerator(team, party.scotty);
            });
        });

        it('unassigns a team member from moderator role for a team', function() {
          return party.kirk.spark.team.unassignModerator(team, party.scotty)
            .then(function() {
              return party.kirk.spark.team.get({
                id: team.id,
                includeTeamMembers: true
              });
            })
            .then(function(team) {
              assert.equal(team.teamMembers.items.length, 2);

              var kirkEntry = find(team.teamMembers.items, {id: party.kirk.id});
              assert.isDefined(kirkEntry);
              assert.isDefined(kirkEntry.roomProperties.isModerator);

              var scottyEntry = find(team.teamMembers.items, {id: party.scotty.id});
              assert.isDefined(scottyEntry);
              assert.isUndefined(scottyEntry.roomProperties);
            });
        });
      });

      describe('#update()', function() {
        var team;
        before(function() {
          return party.kirk.spark.team.create({
            displayName: 'team' + uuid.v4(),
            participants: [
              party.kirk.id
            ]
          })
            .then(function(res) {
              team = res;
            });
        });

        it('updates the displayName for a team', function() {
          var teamName = 'update-team-title-' + uuid.v4();
          team.displayName = teamName;
          return party.kirk.spark.team.update(team)
            .then(function() {
              return party.kirk.spark.team.get({
                id: team.id
              });
            })
            .then(function(team) {
              assert.equal(team.displayName, teamName);
            });
        });

        it('updates the summary for a team', function() {
          var teamSummary = 'update-team-summary-' + uuid.v4();
          team.summary = teamSummary;
          var teamName = 'update-team-title-' + uuid.v4();
          team.displayName = teamName;
          return party.kirk.spark.team.update(team)
            .then(function() {
              return party.kirk.spark.team.get({
                id: team.id
              });
            })
            .then(function(team) {
              assert.equal(team.displayName, teamName);
              assert.equal(team.summary, teamSummary);
            });
        });
      });

      describe('#archive()', function() {
        var team;
        var conversation;
        before(function() {
          return party.kirk.spark.team.create({
            displayName: 'team' + uuid.v4(),
            participants: [
              party.kirk.id
            ]
          })
            .then(function(res) {
              team = res;
              return party.kirk.spark.team.createConversation(team, {
                displayName: 'team-conversation-' + uuid.v4(),
                participants: [
                  party.kirk.id
                ]
              });
            })
            .then(function(res) {
              conversation = res;
            });
        });

        it('archives a team conversation', function() {
          assert.notInclude(conversation.tags, 'ARCHIVED');
          assert.notInclude(conversation.tags, 'HIDDEN');

          return party.kirk.spark.team.archive(conversation)
            .then(function() {
              return party.kirk.spark.team.get({
                id: team.id,
                includeTeamConversations: true
              });
            })
            .then(function(team) {
              assert.isFalse(team.archived);

              conversation = find(team.conversations.items, {id: conversation.id});
              assert.isDefined(conversation);
              assert.include(conversation.tags, 'ARCHIVED');
              assert.include(conversation.tags, 'HIDDEN');
            });
        });

        it('archives a team', function() {
          assert.isFalse(team.archived);

          return party.kirk.spark.team.archive(team)
            .then(function() {
              return party.kirk.spark.team.get(team);
            })
            .then(function(team) {
              assert.isTrue(team.archived);

              team.conversations.items.forEach(function(conversation) {
                assert.include(conversation.tags, 'ARCHIVED');
                assert.include(conversation.tags, 'HIDDEN');
              });
            });
        });
      });

      describe('#unarchive()', function() {
        var team;
        var conversation;
        before(function() {
          return party.kirk.spark.team.create({
            displayName: 'team' + uuid.v4(),
            participants: [
              party.kirk.id
            ]
          })
            .then(function(res) {
              team = res;
              return party.kirk.spark.team.createConversation(team, {
                displayName: 'team-conversation-' + uuid.v4(),
                participants: [
                  party.kirk.id
                ]
              });
            })
            .then(function(res) {
              conversation = res;
              return Promise.all([
                party.kirk.spark.team.archive(team),
                party.kirk.spark.team.archive(conversation)
              ]);
            })
            .then(function() {
              return party.kirk.spark.team.get({
                id: team.id,
                includeTeamConversations: true
              });
            })
            .then(function(res) {
              team = res;
              conversation = find(team.conversations.items, {id: conversation.id});
            });
        });

        it('unarchives a team conversation', function() {
          assert.include(conversation.tags, 'ARCHIVED');
          assert.include(conversation.tags, 'HIDDEN');

          return party.kirk.spark.team.unarchive(conversation)
            .then(function() {
              return party.kirk.spark.team.get({
                id: team.id,
                includeTeamConversations: true
              });
            })
            .then(function(team) {
              assert.isTrue(team.archived);

              conversation = find(team.conversations.items, {id: conversation.id});
              assert.isDefined(conversation);
              assert.notInclude(conversation.tags, 'ARCHIVED');
              assert.notInclude(conversation.tags, 'HIDDEN');
            });

        });

        it('unarchives a team', function() {
          assert.isTrue(team.archived);
          return party.kirk.spark.team.unarchive(team)
            .then(function() {
              return party.kirk.spark.team.get(team);
            })
            .then(function(team) {
              assert.isFalse(team.archived);
            });
        });
      });

      describe('#joinConversation()', function() {
        var team;
        var convo;
        before(function() {
          return party.kirk.spark.team.create({
            displayName: 'team' + uuid.v4(),
            participants: [
              party.kirk.id,
              party.scotty.id
            ]
          })
            .then(function(res) {
              team = res;
              return party.kirk.spark.team.createConversation(team, {
                displayName: 'team-conversation-' + uuid.v4(),
                participants: [
                  party.kirk.id
                ]
              })
                .then(function(conversation) {
                  convo = conversation;
                });
            });
        });

        it('adds the requesting user to a conversation', function() {
          return party.scotty.spark.team.joinConversation(team, convo)
            .then(function(conversation) {
              return party.scotty.spark.conversation.get({url: conversation.url})
                .then(function(conversation) {
                  assert.equal(conversation.participants.items.length, 2);
                  assert.isDefined(find(conversation.participants.items, {id: party.scotty.id}));
                });
            });
        });
      });

      describe('#createConversation()', function() {
        var team;
        before(function() {
          return party.kirk.spark.team.create({
            displayName: 'team' + uuid.v4(),
            participants: [
              party.kirk.id,
              party.scotty.id
            ]
          })
            .then(function(res) {
              team = res;
            });
        });

        it('creates a conversation with a single member within a team', function() {
          var protoConversation = {
            displayName: 'team-conversation-' + uuid.v4(),
            participants: [
              party.kirk.id
            ]
          };

          return party.kirk.spark.team.createConversation(team, protoConversation)
            .then(function(conversation) {
              assert.isDefined(conversation);
              assert.isAbove(conversation.tags.indexOf('OPEN'), -1);
              assert.equal(conversation.tags.indexOf('INCLUDE_ALL_TEAM_MEMBERS'), -1);

              assert.equal(conversation.participants.items.length, 1);
              assert.equal(conversation.team.id, team.id);

              assert.equal(conversation.displayName, protoConversation.displayName);

              return party.scotty.spark.team.getConversations({
                id: team.id
              })
                .then(function(scottyTeamConvos) {
                  var scottyNewConvo = find(scottyTeamConvos, {id: conversation.id});
                  assert.isDefined(scottyNewConvo);
                  assert.equal(scottyNewConvo.displayName, conversation.displayName);
                  assert.isAbove(scottyNewConvo.tags.indexOf('NOT_JOINED'), -1);
                });
            });
        });

        it('creates a conversation with multiple members within a team', function() {
          var protoConversation = {
            displayName: 'team-conversation-' + uuid.v4(),
            participants: [
              party.kirk.id,
              party.scotty.id
            ]
          };

          return party.kirk.spark.team.createConversation(team, protoConversation)
            .then(function(conversation) {
              assert.isDefined(conversation);
              assert.isAbove(conversation.tags.indexOf('OPEN'), -1);
              assert.equal(conversation.tags.indexOf('INCLUDE_ALL_TEAM_MEMBERS'), -1);

              assert.equal(conversation.participants.items.length, 2);
              assert.equal(conversation.team.id, team.id);

              assert.equal(conversation.displayName, protoConversation.displayName);

              return party.scotty.spark.team.getConversations({
                id: team.id
              })
                .then(function(scottyTeamConvos) {
                  var scottyNewConvo = find(scottyTeamConvos, {id: conversation.id});
                  assert.isDefined(scottyNewConvo);
                  assert.equal(scottyNewConvo.displayName, conversation.displayName);
                  assert.isAbove(scottyNewConvo.tags.indexOf('JOINED'), -1);
                });
            });
        });

        it('optionally creates a conversation with all team members',function() {
          return party.kirk.spark.team.createConversation(team, {
            displayName: 'team-conversation-' + uuid.v4(),
            participants: [
              party.kirk.id
            ]
          },
          {
            includeAllTeamMembers: true
          })
            .then(function(conversation) {
              assert.isDefined(conversation);
              assert.isAbove(conversation.tags.indexOf('OPEN'), -1);
              assert.isAbove(conversation.tags.indexOf('INCLUDE_ALL_TEAM_MEMBERS'), -1);
              assert.isAbove(conversation.tags.indexOf('JOINED'), -1);

              // Note the number of participants should be 2 here
              // despite the fact we only included one in the payload because
              // `includeAllTeamMembers` was specfied.`
              assert.equal(conversation.participants.items.length, 2);
              assert.equal(conversation.team.id, team.id);

              return party.scotty.spark.team.getConversations({
                id: team.id
              })
                .then(function(scottyTeamConvos) {
                  var scottyNewConvo = find(scottyTeamConvos, {id: conversation.id});
                  assert.isDefined(scottyNewConvo);
                  assert.equal(scottyNewConvo.displayName, conversation.displayName);
                  assert.isAbove(scottyNewConvo.tags.indexOf('JOINED'), -1);
                });
            });
        });

        it('decrypts the `add` activity appended to the general conversation after a team room is created', function() {
          var protoConversation = {
            displayName: 'team-conversation-' + uuid.v4(),
            participants: [
              party.kirk.id
            ]
          };

          return party.kirk.spark.team.createConversation(team, protoConversation)
            .then(function(conversation) {
              assert.isDefined(conversation);

              return party.kirk.spark.conversation.get({
                id: team.generalConversationUuid,
                activitiesLimit: 10
              })
                .then(function(teamGeneral) {
                  assert.isDefined(teamGeneral);
                  var addActivity = findLast(teamGeneral.activities.items, function(activity) {
                    return activity.verb === 'add' && activity.object.objectType === 'conversation' && activity.object.id === conversation.id;
                  });

                  assert.isDefined(addActivity);
                  assert.equal(addActivity.object.displayName, conversation.displayName);
                });
            });
        });
      });

      describe('#addConversation', function() {
        var team;
        var groupConversation;

        before(function createTeamAndGroupConversation() {
          var teamName = 'team-' + uuid.v4();

          var protoGroupConversation = {
            displayName: 'group-conversation-' + uuid.v4(),
            participants: [
              party.kirk.id,
            ]
          };

          var teamPromise = party.kirk.spark.team.create({
            displayName: teamName,
            participants: [
              party.kirk.id,
              party.scotty.id
            ]
          });

          var promises = [
            teamPromise,
            party.kirk.spark.conversation.create(protoGroupConversation, {forceGrouped: true})
          ];

          return Promise.all(promises)
            .then(function(res) {
              team = res[0];
              groupConversation = res[1];
            });
        });

        it('adds an existing group conversation to a team', function() {
          return party.kirk.spark.team.addConversation(team, groupConversation)
            .then(function assertActivity(activity) {
              assert.equal(activity.verb, 'add');
              assert.equal(activity.target.id, team.id);
              assert.equal(activity.object.id, groupConversation.id);

              return party.scotty.spark.team.get({id: team.id, includeTeamConversations: true});
            })
            .then(function assertTeam(team) {
              assert.equal(team.conversations.items.length, 2);
              var teamConversation = find(team.conversations.items, {id: groupConversation.id});
              assert.isDefined(teamConversation);
              assert.equal(teamConversation.displayName, groupConversation.displayName);

              return party.kirk.spark.conversation.get({id: groupConversation.id});
            })
            .then(function(conversation) {
              assert.isDefined(conversation.team);
              assert.equal(conversation.team.id, team.id);
            });
        });
      });

      describe('#removeConversation', function() {

        var team;
        var teamConversation;

        before(function createTeamAndGroupConversation() {
          var teamName = 'team-' + uuid.v4();

          return party.kirk.spark.team.create({
            displayName: teamName,
            participants: [
              party.kirk.id,
              party.scotty.id
            ]
          })
            .then(function(res) {
              var protoTeamConversation = {
                displayName: 'team-conversation-' + uuid.v4(),
                participants: [
                  party.kirk.id,
                  party.scotty.id
                ]
              };

              return party.kirk.spark.team.createConversation(res, protoTeamConversation)
                .then(function(tc) {
                  teamConversation = tc;
                  return party.kirk.spark.team.get({id: res.id, includeTeamConversations: true});
                });
            })
            .then(function(t) {
              team = t;
            });
        });

        it('removes a team conversation from a team', function() {
          return party.kirk.spark.team.removeConversation(team, teamConversation)
            .then(function assertActivity(activity) {
              assert.equal(activity.verb, 'remove');
              assert.equal(activity.target.id, team.id);
              assert.equal(activity.object.id, teamConversation.id);

              return party.kirk.spark.team.get({id: team.id, includeTeamConversations: true});
            })
            .then(function assertTeam(team) {
              assert.equal(team.conversations.items.length, 1);
              var conversation = find(team.conversations.items, {id: teamConversation.id});
              assert.isUndefined(conversation);

              return party.kirk.spark.conversation.get({id: teamConversation.id});
            })
            .then(function(conversation) {
              assert.isUndefined(conversation.team);
            });
        });
      });
    });
  });
});
