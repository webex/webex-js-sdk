'use strict';

var assert = require('assert');
var ciscospark = require('../../../..');
/* START_EXAMPLE_IGNORE */
it('creates a team', function() {
/* END_EXAMPLE_IGNORE */
return ciscospark.teams.create({name: 'Teams Example'})
  .then(function(team) {
    assert(team.id);
    assert(team.name);
    assert(team.created);
  });
/* START_EXAMPLE_IGNORE */
});
/* END_EXAMPLE_IGNORE */
