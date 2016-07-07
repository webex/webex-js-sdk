'use strict';

var assert = require('assert');
var ciscospark = require('../../../..');
/* START_EXAMPLE_IGNORE */
it('removes a room', function() {
/* END_EXAMPLE_IGNORE */
var room;
return ciscospark.rooms.create({title: 'Rooms Example'})
  .then(function(r) {
    room = r;
    return ciscospark.rooms.remove(room.id);
  })
  .then(function() {
    return ciscospark.rooms.get(room.id);
  })
  .then(function() {
    assert(false, 'the previous get should have failed');
  })
  .catch(function(reason) {
    assert.equal(reason.statusCode, 404);
  });
/* START_EXAMPLE_IGNORE */
});
/* END_EXAMPLE_IGNORE */
