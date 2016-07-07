'use strict';

var assert = require('assert');
var ciscospark = require('../../../..');
/* START_EXAMPLE_IGNORE */
it('updates a room', function() {
/* END_EXAMPLE_IGNORE */
var room;
return ciscospark.rooms.create({title: 'Rooms Example'})
  .then(function(r) {
    room = r;
    room.title = 'Rooms Example (Updated Title)';
    return ciscospark.rooms.update(room);
  })
  .then(function() {
    return ciscospark.rooms.get(room.id);
  })
  .then(function(room) {
    assert.equal(room.title, 'Rooms Example (Updated Title)');
  });
/* START_EXAMPLE_IGNORE */
});
/* END_EXAMPLE_IGNORE */
