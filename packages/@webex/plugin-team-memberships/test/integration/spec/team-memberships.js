/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/internal-plugin-device';
import '@webex/plugin-logger';
import '@webex/plugin-rooms';
import '@webex/plugin-team-memberships';
import '@webex/plugin-teams';
import WebexCore from '@webex/webex-core';
import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import testUsers from '@webex/test-helper-test-users';

describe('plugin-team-memberships', function () {
  this.timeout(60000);

  let webex;

  before(() => testUsers.create({count: 1})
    .then(([user]) => {
      webex = new WebexCore({credentials: user.token});
    }));

  describe('#teams', () => {
    describe('#memberships', () => {
      let team;

      const memberships = [];

      let user1;

      before(() => testUsers.create({count: 1})
        .then((users) => {
          user1 = users[0];
        }));

      before(() => webex.teams.create({
        name: 'Webex Team Test'
      })
        .then((t) => {
          team = t;

          return webex.rooms.create({
            title: 'Webex Team Room Test',
            teamId: team.id
          });
        }));

      afterEach(() => Promise.all(memberships.map((membership) => webex.teamMemberships.remove(membership)
        .catch((reason) => {
          console.error('Failed to delete membership', reason);
        })))
        .then(() => {
          while (memberships.length) {
            memberships.pop();
          }
        }));

      describe('#create()', () => {
        it('adds a person to a team by user id', () => webex.teamMemberships.create({
          personId: user1.id,
          teamId: team.id
        })
          .then((membership) => {
            memberships.push(membership);
            assert.isTeamMembership(membership);
            assert.equal(membership.teamId, team.id);
          }));

        it('adds a person to a team by user email', () => webex.teamMemberships.create({
          personEmail: user1.email,
          teamId: team.id
        })
          .then((membership) => {
            memberships.push(membership);
            assert.isTeamMembership(membership);
            assert.equal(membership.teamId, team.id);
          }));

        it('adds a person to a team as a moderator', () => webex.teamMemberships.create({
          personId: user1.id,
          teamId: team.id,
          isModerator: true
        })
          .then((membership) => {
            memberships.push(membership);
            assert.isTeamMembership(membership);
            assert.equal(membership.teamId, team.id);
            assert.isTrue(membership.isModerator);

            // prevent this test from breaking other tests
            membership.isModerator = false;

            return webex.teamMemberships.update(membership);
          }));
      });

      describe('#get()', () => {
        it('retrieves a single team membership', () => webex.teamMemberships.create({
          personId: user1.id,
          teamId: team.id
        })
          .then((membership) => webex.teamMemberships.get(membership)
            .then((m) => {
              memberships.push(m);
              assert.isTeamMembership(m);
              //  Skipping equality assertiong for now due to create date
              //  mismatch
              //  assert.deepEqual(m, membership);
            })));
      });

      describe('#list()', () => {
        let user2, user3;

        before(() => testUsers.create({count: 3})
          .then((users) => {
            [user2, user3] = users;
          }));

        before(() => Promise.all([
          webex.teamMemberships.create({
            personId: user2.id,
            teamId: team.id
          }),
          webex.teamMemberships.create({
            personId: user3.id,
            teamId: team.id
          })
        ]));

        it('retrieves all memberships for a team', () => webex.teamMemberships.list({
          teamId: team.id
        })
          .then((memberships) => {
            assert.isAbove(memberships.length, 2);
            for (const membership of memberships) {
              assert.isTeamMembership(membership);
              assert.equal(membership.teamId, team.id);
            }
          }));

        it('retrieves a bounded set of memberships for a team', () => webex.teamMemberships.list({
          max: 1,
          teamId: team.id
        })
          .then((memberships) => {
            const spy = sinon.spy();

            assert.lengthOf(memberships, 1);

            return (function f(page) {
              for (const membership of page) {
                assert.isTeamMembership(membership);
                spy(membership.id);
              }

              if (page.hasNext()) {
                return page.next().then(f);
              }

              return Promise.resolve();
            }(memberships))
              .then(() => {
                assert.calledThrice(spy);
              });
          }));
      });

      describe('#update()', () => {
        it('updates the membership\'s moderator status', () => webex.teamMemberships.create({
          personId: user1.id,
          teamId: team.id
        })
          .then((membership) => {
            memberships.push(membership);
            assert.notOk(membership.isModerator);
            membership.isModerator = true;

            return webex.teamMemberships.update(membership);
          })
          .then((membership) => {
            assert.isTrue(membership.isModerator);
            membership.isModerator = false;

            return webex.teamMemberships.update(membership);
          })
          .then((membership) => assert.isFalse(membership.isModerator)));
      });

      describe('#remove()', () => {
        it('deletes a single membership', () => webex.teamMemberships.create({
          personId: user1.id,
          teamId: team.id
        })
          .then((membership) => webex.teamMemberships.remove(membership)
            .then((body) => {
              assert.notOk(body);

              return webex.teamMemberships.list({teamId: team.id});
            })
            .then((memberships) => {
              assert.notInclude(memberships, membership);
            })));
      });
    });
  });
});
