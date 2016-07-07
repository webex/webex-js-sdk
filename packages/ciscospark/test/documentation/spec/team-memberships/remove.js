'use strict';

var assert = require('assert');
var ciscospark = require('../../../..');
/* START_EXAMPLE_IGNORE */
it('removes a person from a team', function() {
/* END_EXAMPLE_IGNORE */
var membership, team;
return ciscospark.teams.create({name: 'Team Memberships Example'})
  .then(function(t) {
    team = t;
    return ciscospark.teamMemberships.create({
     personEmail: 'alice@example.com',
     teamId: team.id
    });
  })
  .then(function(m) {
    membership = m;
    return ciscospark.teamMemberships.list({teamId: team.id});
  })
  .then(function(teamMemberships) {
    assert.equal(teamMemberships.length, 2);
    return ciscospark.teamMemberships.remove(membership);
  })
  .then(function() {
    return ciscospark.teamMemberships.list({teamId: team.id});
  })
  .then(function(teamMemberships) {
    assert.equal(teamMemberships.length, 1);
  });

/* START_EXAMPLE_IGNORE */
});
/* END_EXAMPLE_IGNORE */
