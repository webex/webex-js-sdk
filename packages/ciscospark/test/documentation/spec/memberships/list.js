'use strict';

var assert = require('assert');
var ciscospark = require('../../../..');
/* START_EXAMPLE_IGNORE */
it('lists memberships', function() {
/* END_EXAMPLE_IGNORE */
var room;
return ciscospark.rooms.create({title: 'Memberships Example'})
  .then(function(r) {
    room = r;
    return ciscospark.memberships.create({
     personEmail: 'alice@example.com',
     roomId: room.id
    });
  })
  .then(function() {
    return ciscospark.memberships.list({roomId: room.id});
  })
  .then(function(memberships) {
    assert.equal(memberships.length, 2);
    for (var i = 0; i < memberships.length; i++) {
      assert.equal(memberships.items[i].roomId, room.id);
    }
  });
/* START_EXAMPLE_IGNORE */
});
/* END_EXAMPLE_IGNORE */
