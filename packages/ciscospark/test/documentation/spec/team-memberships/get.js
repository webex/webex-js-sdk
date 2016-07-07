'use strict';
/* START_EXAMPLE_IGNORE */
it('gets a team membership', function() {
/* END_EXAMPLE_IGNORE */
var assert = require('assert');
var ciscospark = require('../../../..');

var membership;
return ciscospark.teams.create({name: 'Team Memberships Example'})
  .then(function(team) {
    return ciscospark.teamMemberships.create({
      personEmail: 'alice@example.com',
      teamId: team.id
    });
  })
  .then(function(m) {
    membership = m;
    return ciscospark.teamMemberships.get(m.id);
  })
  .then(function(m) {
    assert.deepEqual(m, membership);
  });
/* START_EXAMPLE_IGNORE */
});
/* END_EXAMPLE_IGNORE */
