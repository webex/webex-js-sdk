'use strict';

var assert = require('assert');
var ciscospark = require('../../../..');
/* START_EXAMPLE_IGNORE */
it('updates a team membership', function() {
/* END_EXAMPLE_IGNORE */
var membership, team;
return ciscospark.teams.create({name: 'Team Memberships Example'})
  .then(function(t) {
    team = t;
    return ciscospark.teamMemberships.list({teamId: team.id});
  })
  .then(function(teamMemberships) {
    membership = teamMemberships.items[0];
    assert.notEqual(membership.isModerator, true);
    membership.isModerator = true;
    return ciscospark.teamMemberships.update(membership);
  })
  .then(function() {
    return ciscospark.teamMemberships.get(membership.id);
  })
  .then(function(membership) {
    assert.equal(membership.isModerator, true);
  });

/* START_EXAMPLE_IGNORE */
});
/* END_EXAMPLE_IGNORE */
