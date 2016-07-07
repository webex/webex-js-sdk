'use strict';

var inNode = require('../../lib/mocha-helpers').inNode;
var map = require('lodash.map');

var f;
if (inNode()) {
  f = require('./fixtures-v2-node');
}
else {
  f = require('./fixtures-v2-browser');
}

var fixtureHelpers = {
  determineImageDimensions: f.determineImageDimensions,

  isBufferLike: f.isBufferLike,

  isMatchingFile: f.isMatchingFile,

  fetchFixtures: function fetchFixtures(files) {
    return Promise.all(map(files, function(path, key) {
      return f.fetchFixture(path, key)
        .then(function(file) {
          files[key] = file;
        });
    }));
  }
};

module.exports = fixtureHelpers;
