'use strict';

var assert = require('assert');
var ciscospark = require('../../../..');
/* START_EXAMPLE_IGNORE */
it('retrieves a team', function() {
/* END_EXAMPLE_IGNORE */
var team;
return ciscospark.teams.create({name: 'Teams Example'})
  .then(function(r) {
    team = r;
    return ciscospark.teams.get(team.id);
  })
  .then(function(team2) {
    assert.equal(team2.id, team.id);
  });
/* START_EXAMPLE_IGNORE */
});
/* END_EXAMPLE_IGNORE */
