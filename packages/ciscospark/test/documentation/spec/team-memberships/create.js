'use strict';

var assert = require('assert');
var ciscospark = require('../../../..');
/* START_EXAMPLE_IGNORE */
it('creates a team membership', function() {
/* END_EXAMPLE_IGNORE */
return ciscospark.teams.create({name: 'Teams Example'})
  .then(function(team) {
    return ciscospark.teamMemberships.create({
     personEmail: 'alice@example.com',
     teamId: team.id
   });
  })
  .then(function(membership) {
    assert(membership.id);
    assert(membership.teamId);
    assert(membership.personId);
    assert(membership.personEmail);
    assert('isModerator' in membership);
    assert(membership.created);
  });
/* START_EXAMPLE_IGNORE */
});
/* END_EXAMPLE_IGNORE */
