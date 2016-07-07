'use strict';

var path = require('path');
var assert = require('yeoman-assert');
var helpers = require('yeoman-test');

describe.skip('generator-ciscospark:package', function() {
  before(function(done) {
    helpers.run(path.join(__dirname, '../../../generators/package'))
      .withArguments(['test'])
      .withPrompts({
        name: 'Test Name',
        email: 'test@example.com'
      })
      .on('end', done);
  });

  it('creates files', function() {
    assert.file([
      'packages/test/src/index.js',
      'packages/test/test/index.js',
      'packages/test/test/.eslintrc.yml',
      'packages/test/.eslintrc.yml',
      'packages/test/package.json'
    ]);
  });
});
