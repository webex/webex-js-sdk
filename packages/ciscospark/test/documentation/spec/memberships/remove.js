'use strict';

var assert = require('assert');
var ciscospark = require('../../../..');
/* START_EXAMPLE_IGNORE */
it('removes a person from a room', function() {
/* END_EXAMPLE_IGNORE */
var membership, room;
return ciscospark.rooms.create({title: 'Memberships Example'})
  .then(function(r) {
    room = r;
    return ciscospark.memberships.create({
     personEmail: 'alice@example.com',
     roomId: room.id
    });
  })
  .then(function(m) {
    membership = m;
    return ciscospark.memberships.list({roomId: room.id});
  })
  .then(function(memberships) {
    assert.equal(memberships.length, 2);
    return ciscospark.memberships.remove(membership);
  })
  .then(function() {
    return ciscospark.memberships.list({roomId: room.id});
  })
  .then(function(memberships) {
    assert.equal(memberships.length, 1);
  });

/* START_EXAMPLE_IGNORE */
});
/* END_EXAMPLE_IGNORE */
