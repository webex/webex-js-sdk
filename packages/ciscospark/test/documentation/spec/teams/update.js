'use strict';

var assert = require('assert');
var ciscospark = require('../../../..');
/* START_EXAMPLE_IGNORE */
it('updates a teams', function() {
/* END_EXAMPLE_IGNORE */
var teams;
return ciscospark.teams.create({name: 'Teams Example'})
  .then(function(r) {
    teams = r;
    teams.name = 'Teams Example (Updated Title)';
    return ciscospark.teams.update(teams);
  })
  .then(function() {
    return ciscospark.teams.get(teams.id);
  })
  .then(function(teams) {
    assert.equal(teams.name, 'Teams Example (Updated Title)');
  });
/* START_EXAMPLE_IGNORE */
});
/* END_EXAMPLE_IGNORE */
