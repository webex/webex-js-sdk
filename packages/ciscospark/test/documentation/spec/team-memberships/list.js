'use strict';

var assert = require('assert');
var ciscospark = require('../../../..');
/* START_EXAMPLE_IGNORE */
it('lists team memberships', function() {
/* END_EXAMPLE_IGNORE */
var team;
return ciscospark.teams.create({name: 'Memberships Example'})
  .then(function(t) {
    team = t;
    return ciscospark.teamMemberships.create({
     personEmail: 'alice@example.com',
     teamId: team.id
    });
  })
  .then(function() {
    return ciscospark.teamMemberships.list({teamId: team.id});
  })
  .then(function(teamMemberships) {
    assert.equal(teamMemberships.length, 2);
    for (var i = 0; i < teamMemberships.length; i++) {
      assert.equal(teamMemberships.items[i].teamId, team.id);
    }
  });
/* START_EXAMPLE_IGNORE */
});
/* END_EXAMPLE_IGNORE */
