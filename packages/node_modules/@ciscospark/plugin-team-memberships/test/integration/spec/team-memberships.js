/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import '@ciscospark/internal-plugin-wdm';
import '@ciscospark/plugin-logger';
import '@ciscospark/plugin-rooms';
import '@ciscospark/plugin-team-memberships';
import '@ciscospark/plugin-teams';
import CiscoSpark from '@ciscospark/spark-core';
import {assert} from '@ciscospark/test-helper-chai';
import sinon from '@ciscospark/test-helper-sinon';
import testUsers from '@ciscospark/test-helper-test-users';

describe('plugin-team-memberships', function () {
  this.timeout(60000);

  let spark;
  before(() => testUsers.create({count: 1})
    .then(([user]) => {
      spark = new CiscoSpark({credentials: user.token});
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

      before(() => spark.teams.create({
        name: 'Cisco Spark Team Test'
      })
        .then((t) => {
          team = t;

          return spark.rooms.create({
            title: 'Cisco Spark Team Room Test',
            teamId: team.id
          });
        }));

      afterEach(() => Promise.all(memberships.map((membership) => spark.teamMemberships.remove(membership)
        .catch((reason) => {
          console.error('Failed to delete membership', reason);
        })))
        .then(() => {
          while (memberships.length) {
            memberships.pop();
          }
        }));

      describe('#create()', () => {
        it('adds a person to a team by user id', () => spark.teamMemberships.create({
          personId: user1.id,
          teamId: team.id
        })
          .then((membership) => {
            memberships.push(membership);
            assert.isTeamMembership(membership);
            assert.equal(membership.teamId, team.id);
          }));

        it('adds a person to a team by user email', () => spark.teamMemberships.create({
          personEmail: user1.email,
          teamId: team.id
        })
          .then((membership) => {
            memberships.push(membership);
            assert.isTeamMembership(membership);
            assert.equal(membership.teamId, team.id);
          }));

        it('adds a person to a team as a moderator', () => spark.teamMemberships.create({
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
            return spark.teamMemberships.update(membership);
          }));
      });

      describe('#get()', () => {
        it('retrieves a single team membership', () => spark.teamMemberships.create({
          personId: user1.id,
          teamId: team.id
        })
          .then((membership) => spark.teamMemberships.get(membership)
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
          spark.teamMemberships.create({
            personId: user2.id,
            teamId: team.id
          }),
          spark.teamMemberships.create({
            personId: user3.id,
            teamId: team.id
          })
        ]));

        it('retrieves all memberships for a team', () => spark.teamMemberships.list({
          teamId: team.id
        })
          .then((memberships) => {
            assert.isAbove(memberships.length, 2);
            for (const membership of memberships) {
              assert.isTeamMembership(membership);
              assert.equal(membership.teamId, team.id);
            }
          }));

        it('retrieves a bounded set of memberships for a team', () => spark.teamMemberships.list({
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
        it('updates the membership\'s moderator status', () => spark.teamMemberships.create({
          personId: user1.id,
          teamId: team.id
        })
          .then((membership) => {
            memberships.push(membership);
            assert.notOk(membership.isModerator);
            membership.isModerator = true;
            return spark.teamMemberships.update(membership);
          })
          .then((membership) => {
            assert.isTrue(membership.isModerator);
            membership.isModerator = false;
            return spark.teamMemberships.update(membership);
          })
          .then((membership) => assert.isFalse(membership.isModerator)));
      });

      describe('#remove()', () => {
        it('deletes a single membership', () => spark.teamMemberships.create({
          personId: user1.id,
          teamId: team.id
        })
          .then((membership) => spark.teamMemberships.remove(membership)
            .then((body) => {
              assert.notOk(body);
              return spark.teamMemberships.list({teamId: team.id});
            })
            .then((memberships) => {
              assert.notInclude(memberships, membership);
            })));
      });
    });
  });
});
