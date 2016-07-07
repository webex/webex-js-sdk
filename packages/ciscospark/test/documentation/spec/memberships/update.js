'use strict';

var assert = require('assert');
var ciscospark = require('../../../..');
/* START_EXAMPLE_IGNORE */
it('updates a membership', function() {
/* END_EXAMPLE_IGNORE */
var membership, room;
return ciscospark.rooms.create({title: 'Memberships Example'})
  .then(function(r) {
    room = r;
    return ciscospark.memberships.list({roomId: room.id});
  })
  .then(function(memberships) {
    membership = memberships.items[0];
    assert.equal(membership.isModerator, false);
    membership.isModerator = true;
    return ciscospark.memberships.update(membership);
  })
  .then(function() {
    return ciscospark.memberships.get(membership.id);
  })
  .then(function(membership) {
    assert.equal(membership.isModerator, true);
  });

/* START_EXAMPLE_IGNORE */
});
/* END_EXAMPLE_IGNORE */
