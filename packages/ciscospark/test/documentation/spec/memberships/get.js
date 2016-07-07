'use strict';
/* START_EXAMPLE_IGNORE */
it('gets a membership', function() {
/* END_EXAMPLE_IGNORE */
var assert = require('assert');
var ciscospark = require('../../../..');

var membership;
return ciscospark.rooms.create({title: 'Memberships Example'})
  .then(function(room) {
    return ciscospark.memberships.create({
      personEmail: 'alice@example.com',
      roomId: room.id
    });
  })
  .then(function(m) {
    membership = m;
    return ciscospark.memberships.get(m.id);
  })
  .then(function(m) {
    assert.deepEqual(m, membership);
  });
/* START_EXAMPLE_IGNORE */
});
/* END_EXAMPLE_IGNORE */
