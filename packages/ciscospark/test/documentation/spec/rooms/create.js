'use strict';

var assert = require('assert');
var ciscospark = require('../../../..');
/* START_EXAMPLE_IGNORE */
it('creates a room', function() {
/* END_EXAMPLE_IGNORE */
return ciscospark.rooms.create({title: 'Rooms Example'})
  .then(function(room) {
    assert(room.id);
    assert(room.title);
    assert(room.created);
  });
/* START_EXAMPLE_IGNORE */
});
/* END_EXAMPLE_IGNORE */
