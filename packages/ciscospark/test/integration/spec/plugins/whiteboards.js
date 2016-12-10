/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@ciscospark/test-helper-chai';
import {SparkHttpError} from '@ciscospark/spark-core';
import sinon from '@ciscospark/test-helper-sinon';
import spark from '../../..';
import util from 'util';
import {createRooms, createBoards} from '../testutil';

describe(`ciscospark`, function() {
  this.timeout(60000);

  describe(`#whiteboards`, () => {

    beforeEach(() => spark.device.register());
    afterEach(() => spark.device.unregister());

    const rooms = [];
    afterEach(() => {
      return Promise.all(rooms.map((room) => {
        return spark.rooms.remove(room)
          .catch((reason) => {
            console.error(`Failed to delete room`, reason);
          });
      }))
        .then(() => {
          while (rooms.length) {
            rooms.pop();
          }
        });
    });

    describe(`#create()`, () => {
      it(`creates a whiteboard for a room`, () => {
          return spark.rooms.create({title: `Cisco Spark Test Room`})
            .then((room) => {
              rooms.push(room);
              const body = {roomId: room.id};
              return spark.whiteboards.create(body);
            })
            .then((board) => {
                assert.isWhiteboard(board);
                assert.isHydraID(board.roomId);
                return spark.whiteboards.get(board.id)
                  .then((got) => {
                    assert.isWhiteboard(got);
                    assert.equal(got.id, board.id);
                    assert.equal(got.roomId, board.roomId);
                  });
            });
      });
    });


    describe(`#list()`, () => {
      let boards;
      const numRooms = 2;
      const numBoards = 2;
      beforeEach(() => {
        boards = {};
        return createRooms(numRooms, spark)
          .then((roomList) => Promise.all(roomList.map((room) => {
            rooms.push(room);
            boards[room.id] = [];
            return createBoards(numBoards, room.id, spark)
              .then((boardList) =>
                Promise.all(
                  boardList.map((board) =>
                    boards[room.id].push(board))));
          })));
      });

      it(`retrieves boards by room ID`, () => {
        return spark.whiteboards.list({ roomId: rooms[0].id })
          .then((res) => {
            assert.isArray(res.items);
            assert.equal(res.items.length, numBoards);
            for (const board of res.items) {
              assert.isWhiteboard(board);
              assert.equal(board.roomId, rooms[0].id, `Room 0's id matches`);
            }

            assert.notEqual(res.items.findIndex((board) =>
              (board.id === boards[rooms[0].id][0].id)), -1, `Board 0 found`);
            assert.notEqual(res.items.findIndex((board) =>
              (board.id === boards[rooms[0].id][1].id)), -1, `Board 1 found`);
          });
      });
    });
  });
});
