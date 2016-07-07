'use strict';

var assert = require('assert');
var ciscospark = require('../../../..');
/* START_EXAMPLE_IGNORE */
it('creates a membership', function() {
/* END_EXAMPLE_IGNORE */
return ciscospark.rooms.create({title: 'Rooms Example'})
  .then(function(room) {
    return ciscospark.memberships.create({
     personEmail: 'alice@example.com',
     roomId: room.id
   });
  })
  .then(function(membership) {
    assert(membership.id);
    assert(membership.roomId);
    assert(membership.personId);
    assert(membership.personEmail);
    assert('isModerator' in membership);
    assert('isMonitor' in membership);
    assert(membership.created);
  });
/* START_EXAMPLE_IGNORE */
});
/* END_EXAMPLE_IGNORE */
