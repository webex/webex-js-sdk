'use strict';

var path = require('path');
var assert = require('yeoman-assert');
var helpers = require('yeoman-test');

describe.skip('generator-ciscospark:plugin', function() {
  beforeEach(function(done) {
    helpers.run(path.join(__dirname, '../../../generators/plugin'))
      .withGenerators([
        [helpers.createDummyGenerator(), 'ciscospark:package']
      ])
      .withArguments(['plugin-test'])
      .withPrompts({
        name: 'Test Name',
        email: 'test@example.com'
      })
      .on('end', done);
  });

  it('creates files', function() {
    assert.file([
      'packages/plugin-test/src/index.js',
      'packages/plugin-test/src/test.js'
    ]);
  });
});
