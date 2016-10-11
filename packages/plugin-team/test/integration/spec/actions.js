/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import '../..';
import '@ciscospark/plugin-wdm';

import {assert} from '@ciscospark/test-helper-chai';
import CiscoSpark from '@ciscospark/spark-core';
import {find} from 'lodash';
import testUsers from '@ciscospark/test-helper-test-users';
import uuid from 'uuid';

describe(`plugin-team`, () => {
  describe(`Team`, () => {

    let kirk, spock;

    before(() => testUsers.create({count: 2})
      .then((users) => {
        [kirk, spock] = users;

        kirk.spark = new CiscoSpark({
          credentials: {
            authorization: kirk.token
          },
          config: {
            conversation: {
              keepEncryptedProperties: true
            }
          }
        });

        spock.spark = new CiscoSpark({
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
          kirk.spark.mercury.connect(),
          spock.spark.mercury.connect()
        ]);
      })
    );

    after(() => Promise.all([
      kirk && kirk.spark.mercury.disconnect(),
      spock && spock.spark.mercury.disconnect()
    ]));

    describe(`#addConversation()`, () => {
      let groupConversation, team;
      before(() => {
        const teamPromise = kirk.spark.team.create({
          displayName: `team-${uuid.v4()}`,
          participants: [
            kirk,
            spock
          ]
        });

        const conversation = {
          displayName: `group-conversation-${uuid.v4()}`,
          participants: [
            kirk
          ]
        };

        return Promise.all([
          teamPromise,
          kirk.spark.conversation.create(conversation, {forceGrouped: true})
        ])
          .then(([t, c]) => {
            team = t;
            groupConversation = c;
          });
      });

      it(`adds an existing group conversation to a team`, () => kirk.spark.team.addConversation(team, groupConversation)
        .then((activity) => {
          assert.isActivity(activity);
          assert.equal(activity.verb, `add`);
          assert.equal(activity.target.id, team.id);
          assert.equal(activity.object.id, groupConversation.id);

          return spock.spark.team.get(team, {includeTeamConversations: true});
        })
        .then((t) => {
          assert.equal(t.conversations.items.length, 2);
          const teamConversation = find(t.conversations.items, {id: groupConversation.id});
          const generalConversation = find(t.conversations.items, {id: t.generalConversationUuid});
          assert.include(teamConversation.tags, `OPEN`);

          // Ensure that spock can decrypt the title of the room now that
          // it's been added to a team he's a member of.
          assert.equal(generalConversation.displayName, team.displayName);
          assert.equal(teamConversation.displayName, groupConversation.displayName);

          return kirk.spark.conversation.get(groupConversation);
        })
        .then((conversation) => {
          assert.isDefined(conversation.team);
          assert.equal(conversation.team.id, team.id);
        }));
    });

    describe(`#addMember()`, () => {
      let additionalConversation, team;

      before(() => kirk.spark.team.create({
        displayName: `team-${uuid.v4()}`,
        participants: [
          kirk
        ]
      })
      .then((res) => {
        team = res;

        return kirk.spark.team.createConversation(team, {
          displayName: `team-conversation-${uuid.v4()}`,
          participants: [
            kirk
          ]
        })
          .then((conversation) => {
            additionalConversation = conversation;
          });
      }));

      it(`adds a team member to a team`, () => kirk.spark.team.addMember(team, spock)
        .then((activity) => {
          assert.isActivity(activity);
          assert.equal(activity.verb, `add`);
          assert.equal(activity.target.id, team.id);
          assert.equal(activity.object.id, spock.id);

          return kirk.spark.team.get(team, {
            includeTeamMembers: true
          });
        })
        .then((team) => {
          const spockEntry = find(team.teamMembers.items, {id: spock.id});
          assert.isDefined(spockEntry);
          assert.isUndefined(spockEntry.roomProperties);

          // Assert spock can decrypt team and its rooms
          return spock.spark.team.get(team, {
            includeTeamConversations: true
          })
            .then((spockTeam) => {
              assert.isDefined(spockTeam);
              assert.notEqual(spockTeam.displayName, spockTeam.encryptedDisplayName);
              assert.equal(spockTeam.displayName, team.displayName);
              assert.equal(spockTeam.conversations.items.length, 2);

              const spockAddtlConversation = find(spockTeam.conversations.items, {id: additionalConversation.id});
              assert.isDefined(spockAddtlConversation);
              assert.notEqual(spockAddtlConversation.displayName, spockAddtlConversation.encryptedDisplayName);
              assert.equal(spockAddtlConversation.displayName, additionalConversation.displayName);
              assert.include(spockAddtlConversation.tags, `NOT_JOINED`);
            });
        }));
    });

    describe(`#assignModerator()`, () => {
      let team;

      before(() => kirk.spark.team.create({
        displayName: `team-${uuid.v4()}`,
        participants: [
          kirk,
          spock
        ]
      })
      .then((t) => {
        team = t;
      }));

      it(`assigns a team moderator`, () => kirk.spark.team.assignModerator(team, spock)
        .then((activity) => {
          assert.isActivity(activity);
          assert.equal(activity.verb, `assignModerator`);
          assert.equal(activity.target.id, team.id);
          assert.equal(activity.object.id, spock.id);

          return kirk.spark.team.get(team, {
            includeTeamMembers: true
          });
        })
        .then((team) => {
          const spockEntry = find(team.teamMembers.items, {id: spock.id});
          assert.isDefined(spockEntry);
          assert.isTrue(spockEntry.roomProperties.isModerator);
        }));
    });

    describe(`#archive()`, () => {
      let conversation, team;

      before(() => kirk.spark.team.create({
        displayName: `team-${uuid.v4()}`,
        participants: [
          kirk
        ]
      })
      .then((t) => {
        team = t;
        return kirk.spark.team.createConversation(team, {
          displayName: `team-conversation-${uuid.v4()}`,
          participants: [
            kirk
          ]
        });
      })
      .then((c) => {
        conversation = c;
      }));

      it(`archives a team conversation`, () => {
        assert.notInclude(conversation.tags, `ARCHIVED`);
        assert.notInclude(conversation.tags, `HIDDEN`);

        return kirk.spark.team.archive(conversation)
          .then((activity) => {
            assert.isActivity(activity);
            assert.equal(activity.verb, `archive`);
            assert.equal(activity.target.id, conversation.id);
            assert.equal(activity.object.id, conversation.id);

            return kirk.spark.team.get(team, {includeTeamConversations: true});
          })
          .then((t) => {
            assert.isFalse(t.archived);

            conversation = find(t.conversations.items, {id: conversation.id});
            assert.isDefined(conversation);
            assert.include(conversation.tags, `ARCHIVED`);
            assert.include(conversation.tags, `HIDDEN`);
          });
      });

      it(`archives a team`, () => {
        assert.isFalse(team.archived);

        return kirk.spark.team.archive(team)
          .then((activity) => {
            assert.isActivity(activity);
            assert.equal(activity.verb, `archive`);
            assert.equal(activity.target.id, team.id);
            assert.equal(activity.object.id, team.id);

            return kirk.spark.team.get(team, {includeTeamConversations: true});
          })
          .then((t) => {
            assert.isTrue(t.archived);

            const generalConversation = find(t.conversations.items, {id: team.generalConversationUuid});
            assert.isDefined(generalConversation);
            assert.include(generalConversation.tags, `ARCHIVED`);
            assert.include(generalConversation.tags, `HIDDEN`);
          });
      });
    });

    describe(`#joinConversation()`, () => {
      let conversation, team;
      before(() => kirk.spark.team.create({
        displayName: `team-${uuid.v4()}`,
        participants: [
          kirk,
          spock
        ]
      })
      .then((t) => {
        team = t;
        return kirk.spark.team.createConversation(t, {
          displayName: `team-room-${uuid.v4()}`,
          participants: [kirk]
        });
      })
      .then((c) => {
        conversation = c;
      }));

      it(`adds the user to an open team conversation`, () => spock.spark.team.joinConversation(team, conversation)
        .then((c) => assert.notInclude(c.tags, `NOT_JOINED`)));
    });

    describe(`#removeConversation()`, () => {
      let conversation, team;
      before(() => kirk.spark.team.create({
        displayName: `team-${uuid.v4()}`,
        participants: [
          kirk,
          spock
        ]
      })
      .then((t) => {
        team = t;
        return kirk.spark.team.createConversation(t, {
          displayName: `team-room-${uuid.v4()}`,
          participants: [kirk]
        });
      })
      .then((c) => {
        conversation = c;
      }));

      it(`removes a team conversation from a team`, () => kirk.spark.team.removeConversation(team, conversation)
        .then((activity) => {
          assert.isActivity(activity);
          assert.equal(activity.verb, `remove`);
          assert.equal(activity.target.id, team.id);
          assert.equal(activity.object.id, conversation.id);
          return kirk.spark.team.get(team, {includeTeamConversations: true});
        })
        .then((t) => {
          assert.lengthOf(t.conversations.items, 1);
          assert.isUndefined(find(t.conversations.items, {id: conversation.id}));
        }));
    });

    describe(`#removeMember()`, () => {
      let team;

      before(() => kirk.spark.team.create({
        displayName: `team-${uuid.v4()}`,
        participants: [
          kirk,
          spock
        ]
      })
      .then((t) => {
        team = t;
      }));

      it(`removes a team member from a team`, () => kirk.spark.team.removeMember(team, spock)
        .then((activity) => {
          assert.isActivity(activity);
          assert.equal(activity.verb, `leave`);
          assert.equal(activity.target.id, team.id);
          assert.equal(activity.object.id, spock.id);

          return kirk.spark.team.get(team, {
            includeTeamMembers: true
          });
        })
        .then((team) => {
          assert.equal(team.teamMembers.items.length, 1);
          assert.equal(team.teamMembers.items[0].id, kirk.id);
        }));
    });

    describe(`#unassignModerator()`, () => {
      let team;

      before(() => kirk.spark.team.create({
        displayName: `team-${uuid.v4()}`,
        participants: [
          kirk,
          spock
        ]
      })
      .then((t) => {
        team = t;
        return kirk.spark.team.assignModerator(team, spock);
      }));

      it(`unassigns a team moderator`, () => kirk.spark.team.unassignModerator(team, spock)
        .then((activity) => {
          assert.isActivity(activity);
          assert.equal(activity.verb, `unassignModerator`);
          assert.equal(activity.target.id, team.id);
          assert.equal(activity.object.id, spock.id);

          return kirk.spark.team.get(team, {
            includeTeamMembers: true
          });
        })
        .then((team) => {
          const spockEntry = find(team.teamMembers.items, {id: spock.id});
          assert.isDefined(spockEntry);
          assert.isUndefined(spockEntry.roomProperties);
        }));
    });

    describe(`#unarchive()`, () => {
      let conversation, team;

      before(() => kirk.spark.team.create({
        displayName: `team-${uuid.v4()}`,
        participants: [
          kirk
        ]
      })
      .then((t) => {
        team = t;
        return kirk.spark.team.createConversation(team, {
          displayName: `team-conversation-${uuid.v4()}`,
          participants: [
            kirk
          ]
        });
      })
      .then((c) => {
        conversation = c;
        return Promise.all([
          kirk.spark.team.archive(conversation),
          kirk.spark.team.archive(team)
        ]);
      })
      .then(() => kirk.spark.team.get(team, {includeTeamConversations: true}))
      .then((t) => {
        team = t;
        conversation = find(team.conversations.items, {id: conversation.id});
      }));

      it(`unarchives a team conversation`, () => {
        assert.include(conversation.tags, `ARCHIVED`);
        assert.include(conversation.tags, `HIDDEN`);

        return kirk.spark.team.unarchive(conversation)
          .then((activity) => {
            assert.isActivity(activity);
            assert.equal(activity.verb, `unarchive`);
            assert.equal(activity.target.id, conversation.id);
            assert.equal(activity.object.id, conversation.id);

            return kirk.spark.team.get(team, {includeTeamConversations: true});
          })
          .then((t) => {
            conversation = find(t.conversations.items, {id: conversation.id});
            assert.isDefined(conversation);
            assert.notInclude(conversation.tags, `ARCHIVED`);
            assert.notInclude(conversation.tags, `HIDDEN`);
          });
      });

      it(`unarchives a team`, () => {
        assert.isTrue(team.archived);

        return kirk.spark.team.unarchive(team)
          .then((activity) => {
            assert.isActivity(activity);
            assert.equal(activity.verb, `unarchive`);
            assert.equal(activity.target.id, team.id);
            assert.equal(activity.object.id, team.id);

            return kirk.spark.team.get(team, {includeTeamConversations: true});
          })
          .then((t) => {
            assert.isFalse(t.archived);

            const generalConversation = find(t.conversations.items, {id: team.generalConversationUuid});
            assert.isDefined(generalConversation);
            assert.notInclude(generalConversation.tags, `ARCHIVED`);
            assert.notInclude(generalConversation.tags, `HIDDEN`);
          });
      });
    });

    describe(`#update()`, () => {

      let team;

      before(() => kirk.spark.team.create({
        displayName: `team-${uuid.v4()}`,
        participants: [
          kirk
        ]
      })
      .then((t) => {
        team = t;
      }));

      it(`updates a team displayName`, () => {
        const obj = {
          displayName: `updated-team-title-${uuid.v4()}`,
          objectType: `team`
        };

        return kirk.spark.team.update(team, obj)
          .then((activity) => {
            assert.isActivity(activity);
            assert.equal(activity.verb, `update`);
            assert.equal(activity.target.id, team.id);
          })
          .then(() => kirk.spark.team.get(team))
          .then((t) => assert.equal(t.displayName, obj.displayName));
      });

      it(`updates a team summary`, () => {
        const obj = {
          summary: `updated-team-summary-${uuid.v4()}`,
          objectType: `team`
        };

        return kirk.spark.team.update(team, obj)
          .then((activity) => {
            assert.isActivity(activity);
            assert.equal(activity.verb, `update`);
            assert.equal(activity.target.id, team.id);
          })
          .then(() => kirk.spark.team.get(team))
          .then((t) => assert.equal(t.summary, obj.summary));
      });

    });

  });
});
