'use strict';

var assert = require('assert');
var ciscospark = require('../../../..');
/* START_EXAMPLE_IGNORE */
it('lists a set of rooms', function() {
/* END_EXAMPLE_IGNORE */
var createdRooms;
return Promise.all([
  ciscospark.rooms.create({title: 'Rooms Example 1'}),
  ciscospark.rooms.create({title: 'Rooms Example 2'}),
  ciscospark.rooms.create({title: 'Rooms Example 3'})
])
  .then(function(r) {
    createdRooms = r;
    return ciscospark.rooms.list({max: 3});
  })
  .then(function(rooms) {
    assert(rooms.length === 3);
    for (var i = 0; i < rooms.items.length; i++) {
      /* eslint no-loop-func: [0] */
      assert(createdRooms.filter(function(room) {
        return room.id === rooms.items[i].id;
      }).length === 1);
    }
  });
/* START_EXAMPLE_IGNORE */
});
/* END_EXAMPLE_IGNORE */
