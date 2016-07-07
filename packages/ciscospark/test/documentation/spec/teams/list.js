'use strict';

var assert = require('assert');
var ciscospark = require('../../../..');
/* START_EXAMPLE_IGNORE */
it('lists a set of teams', function() {
/* END_EXAMPLE_IGNORE */
var createdRooms;
return Promise.all([
  ciscospark.teams.create({name: 'Teams Example 1'}),
  ciscospark.teams.create({name: 'Teams Example 2'}),
  ciscospark.teams.create({name: 'Teams Example 3'})
])
  .then(function(r) {
    createdRooms = r;
    return ciscospark.teams.list({max: 3});
  })
  .then(function(teams) {
    assert(teams.length === 3);
    for (var i = 0; i < teams.items.length; i++) {
      /* eslint no-loop-func: [0] */
      assert(createdRooms.filter(function(room) {
        return room.id === teams.items[i].id;
      }).length === 1);
    }
  });
/* START_EXAMPLE_IGNORE */
});
/* END_EXAMPLE_IGNORE */
