'use strict';

var assert = require('assert');
var ciscospark = require('../../../..');
/* START_EXAMPLE_IGNORE */
it('searches for people', function() {
/* END_EXAMPLE_IGNORE */
var room;
return ciscospark.rooms.create({title: 'People Example'})
  .then(function(r) {
    room = r;
    return ciscospark.memberships.create({
      personEmail: 'alice@example.com',
      roomId: room.id
    });
  })
  .then(function() {
    return ciscospark.memberships.create({
      personEmail: 'bob@example.com',
      roomId: room.id
    });
  })
  .then(function() {
    return ciscospark.people.list({email: 'alice@example.com'});
  })
  .then(function(people) {
    assert.equal(people.length, 1);
    var person = people.items[0];
    assert(person.id);
    assert(Array.isArray(person.emails));
    assert(person.displayName);
    assert(person.created);
  });
/* START_EXAMPLE_IGNORE */
});
/* END_EXAMPLE_IGNORE */
