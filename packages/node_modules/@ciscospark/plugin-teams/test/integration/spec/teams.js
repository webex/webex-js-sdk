/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import '@ciscospark/internal-plugin-wdm';
import '@ciscospark/plugin-logger';
import '@ciscospark/plugin-memberships';
import '@ciscospark/plugin-rooms';
import '@ciscospark/plugin-teams';
import CiscoSpark, {SparkHttpError} from '@ciscospark/spark-core';
import {assert} from '@ciscospark/test-helper-chai';
import sinon from '@ciscospark/test-helper-sinon';
import testUsers from '@ciscospark/test-helper-test-users';
import {find} from 'lodash';

describe('plugin-teams', function () {
  this.timeout(60000);

  let spark, user;
  before(() => testUsers.create({count: 1})
    .then(([u]) => {
      user = u;
      spark = new CiscoSpark({credentials: user.token});
    }));

  describe('#teams', () => {
    describe('#create()', () => {
      it('creates a team', () => spark.teams.create({
        name: 'Cisco Spark Test Team (create)'
      })
        .then((team) => assert.isTeam(team)));
    });

    describe('#get()', () => {
      it('retrieves a specific team', () => spark.teams.create({
        name: 'Cisco Spark Test Team (get)'
      })
        .then((team) => {
          assert.isTeam(team);
          return spark.teams.get({id: team.id})
            .then((result) => assert.deepEqual(result, team));
        }));
    });

    describe('#list()', () => {
      // Reminder: we can't run the next two creates in parallel because some of
      // the tests rely on ordering.
      let team0, team1;
      before(() => spark.teams.create({name: 'Cisco Spark Test Team 1'})
        .then((team) => {
          team1 = team;
        }));

      before(() => spark.teams.create({name: 'Cisco Spark Test Team 0'})
        .then((team) => {
          team0 = team;
        }));

      it('lists all of the teams to which I have access', () => spark.teams.list()
        .then((teams) => {
          assert.isAbove(teams.length, 1);
          for (const team of teams) {
            assert.isTeam(team);
          }
        }));

      it('lists a bounded, pageable set of teams to which I have access', () => spark.teams.list({max: 1})
        .then((teams) => {
          assert.lengthOf(teams, 1);
          const spy = sinon.spy();
          return (function f(page) {
            for (const team of page) {
              spy(team.id);
            }

            if (page.hasNext()) {
              return page.next().then(f);
            }

            return Promise.resolve();
          }(teams))
            .then(() => {
              assert.isAbove(spy.callCount, 1);
              assert.calledWith(spy, team0.id);
              assert.calledWith(spy, team1.id);
            });
        }));
    });

    describe('#update()', () => {
      it('updates a single team\'s name', () => spark.teams.create({
        name: 'Cisco Spark Test Team'
      })
        .then((team) => {
          assert.isTeam(team);
          return spark.teams.update(Object.assign({}, team, {name: 'Cisco Spark Test Team (Updated)'}));
        })
        .then((team) => {
          assert.isTeam(team);
          assert.equal(team.name, 'Cisco Spark Test Team (Updated)');
        }));
    });
  });

  describe('#rooms', () => {
    let team;

    before(() => spark.teams.create({
      name: 'Cisco Spark Test Team'
    })
      .then((t) => { team = t; }));

    describe('#create()', () => {
      // COLLAB-1104 create date don't match; Mike is working on a fix
      it.skip('creates a room that is part of a team', () => spark.rooms.create({
        title: 'Team Room',
        teamId: team.id
      })
        .then((room) => {
          assert.isTeamRoom(room);
          assert.equal(room.teamId, team.id);
        }));
    });

    describe('#get()', () => {
      it('retrieves a specific room that is part of a team', () => spark.rooms.create({
        title: 'Team Room',
        teamId: team.id
      })
        .then((room) => spark.rooms.get(room))
        .then((room) => {
          assert.isTeamRoom(room);
          assert.equal(room.teamId, team.id);
        }));

      describe('when the user leaves the team\'s general room', () => {
        let room, team;

        it('no longer returns the team\'s rooms', () => spark.teams.create({
          name: 'Team Title'
        })
          .then((t) => {
            team = t;
            return spark.rooms.create({
              title: 'Room Title',
              teamId: team.id
            });
          })
          .then((r) => {
            room = r;
            return spark.rooms.list({teamId: team.id});
          })
          .then((teamRooms) => {
            assert.lengthOf(teamRooms, 2);
            const generalRoom = find(teamRooms.items, (r) => r.id !== room.id);
            return spark.memberships.list({roomId: generalRoom.id, personId: user.id});
          })
          .then((memberships) => spark.memberships.remove(memberships.items[0]))
          .then(() => assert.isRejected(spark.rooms.get(room)))
          .then((reason) => {
            assert.instanceOf(reason, SparkHttpError.NotFound);
          }));
      });
    });

    describe('#list()', () => {
      it('lists all rooms in a team', () => spark.rooms.create({
        title: 'Team Room',
        teamId: team.id
      })
        .then(() => spark.rooms.list({teamId: team.id}))
        .then((rooms) => {
          assert.isAbove(rooms.length, 0);
          for (const room of rooms) {
            assert.isTeamRoom(room);
            assert.equal(room.teamId, team.id);
          }
        }));
    });
  });
});
