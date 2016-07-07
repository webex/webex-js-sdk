'use strict';

var assert = require('assert');
var ciscospark = require('../../../..');
/* START_EXAMPLE_IGNORE */
it('retrieves a room', function() {
/* END_EXAMPLE_IGNORE */
var room;
return ciscospark.rooms.create({title: 'Rooms Example'})
  .then(function(r) {
    room = r;
    return ciscospark.rooms.get(room.id);
  })
  .then(function(room2) {
    assert.equal(room2.id, room.id);
  });
/* START_EXAMPLE_IGNORE */
});
/* END_EXAMPLE_IGNORE */
