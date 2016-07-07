'use strict';

var assert = require('assert');
var ciscospark = require('../../../..');
/* START_EXAMPLE_IGNORE */
it('gets a person', function() {
/* END_EXAMPLE_IGNORE */
return ciscospark.rooms.create({title: 'People Example'})
  .then(function(room) {
    return ciscospark.memberships.create({
      personEmail: 'alice@example.com',
      roomId: room.id
    });
  })
  .then(function(membership) {
    return ciscospark.people.get(membership.personId);
  })
  .then(function(alice) {
    assert(alice.id);
    assert(Array.isArray(alice.emails));
    assert.equal(alice.emails.filter(function(email) {
      return email === 'alice@example.com';
    }).length, 1);
    assert(alice.displayName);
    assert(alice.created);
  });
/* START_EXAMPLE_IGNORE */
});
/* END_EXAMPLE_IGNORE */
