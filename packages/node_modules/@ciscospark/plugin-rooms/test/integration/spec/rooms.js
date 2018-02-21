/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import '@ciscospark/internal-plugin-wdm';
import '@ciscospark/plugin-logger';
import '@ciscospark/plugin-rooms';
import CiscoSpark, {SparkHttpError} from '@ciscospark/spark-core';
import {assert} from '@ciscospark/test-helper-chai';
import sinon from '@ciscospark/test-helper-sinon';
import testUsers from '@ciscospark/test-helper-test-users';

describe('plugin-rooms', function () {
  this.timeout(60000);

  let spark;
  before(() => testUsers.create({count: 1})
    .then(([user]) => {
      spark = new CiscoSpark({credentials: user.token});
    }));

  describe('#rooms', () => {
    const rooms = [];

    afterEach(() => Promise.all(rooms.map((room) => spark.rooms.remove(room)
      .catch((reason) => {
        console.error('Failed to delete room', reason);
      })))
      .then(() => {
        while (rooms.length) {
          rooms.pop();
        }
      }));

    describe('#create()', () => {
      it('creates a room', () => spark.rooms.create({title: 'Cisco Spark Test Room'})
        .then((room) => {
          rooms.push(room);
          assert.isRoom(room);
        }));
    });

    describe('#get()', () => {
      let room0;
      beforeEach(() => Promise.all([
        spark.rooms.create({title: 'Cisco Spark Test Room 1'})
          .then((room) => {
            rooms.push(room);
          }),
        spark.rooms.create({title: 'Cisco Spark Test Room 0'})
          .then((room) => {
            rooms.push(room);
            room0 = room;
          })
      ]));

      it('retrieves a specific room', () => spark.rooms.get(room0)
        .then((room) => {
          assert.isRoom(room);

          assert.equal(room.id, room0.id);
          assert.equal(room.title, room0.title);
        }));
    });

    describe('#list()', () => {
      // Reminder: we can't run the next two creates in parallel because some of
      // the tests rely on ordering.
      let room0, room1;
      beforeEach(() => spark.rooms.create({title: 'Cisco Spark Test Room 1'})
        .then((room) => {
          rooms.push(room);
          room1 = room;
        }));

      beforeEach(() => spark.rooms.create({title: 'Cisco Spark Test Room 0'})
        .then((room) => {
          rooms.push(room);
          room0 = room;
        }));

      it('retrieves all the rooms to which I have access', () => spark.rooms.list()
        .then((rooms) => {
          for (const room of rooms) {
            assert.isRoom(room);
          }
          assert.equal(rooms.items[0].id, room0.id, 'Room 0\'s id matches');
          assert.equal(rooms.items[0].title, room0.title, 'Room 0\'s title matches');
          assert.equal(rooms.items[1].id, room1.id, 'Room 1\'s id matches');
          assert.equal(rooms.items[1].title, room1.title, 'Room 1\'s title matches');
        }));

      it('retrieves a bounded, pageable set of rooms to which I have access', () => {
        const spy = sinon.spy();
        return spark.rooms.list({max: 1})
          .then((rooms) => {
            assert.lengthOf(rooms, 1);
            return (function f(page) {
              for (const room of page) {
                spy(room.id);
              }

              if (page.hasNext()) {
                return page.next().then(f);
              }

              return Promise.resolve();
            }(rooms));
          })
          .then(() => {
            assert.isAbove(spy.callCount, 1);
            assert.calledWith(spy, room0.id);
            assert.calledWith(spy, room1.id);
          });
      });
    });

    describe('#update()', () => {
      let room;
      beforeEach(() => spark.rooms.create({title: 'Cisco Spark Test Room'})
        .then((r) => {
          room = r;
          rooms.push(room);
          assert.property(room, 'id');
        }));

      it('updates a single room\'s title', () => {
        const r = Object.assign({}, room, {title: 'Cisco Spark Test Room with New Title'});
        spark.rooms.update(r)
          .then((room) => {
            assert.isRoom(room);
            assert.deepEqual(room, r);
          });
      });
    });

    describe('#remove()', () => {
      let room;
      beforeEach(() => spark.rooms.create({title: 'Cisco Spark Test Room'})
        .then((r) => {
          room = r;
          assert.property(room, 'id');
        }));

      it('deletes a single room', () => spark.rooms.remove(room)
        .then((body) => {
          assert.notOk(body);
          return assert.isRejected(spark.rooms.get(room));
        })
        .then((reason) => {
          assert.instanceOf(reason, SparkHttpError.NotFound);
        }));
    });
  });
});
