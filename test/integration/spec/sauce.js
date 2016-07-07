/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var forEach = require('lodash.foreach');
var fh2 = require('../lib/fixtures-v2');
var skipInNode = require('../../lib/mocha-helpers').skipInNode;

skipInNode(describe)('Sauce Labs', function() {
  this.timeout(10000);

  var fixtures = {
    sampleImageSmallOnePng: 'sample-image-small-one.png',
    sampleImageSmallTwoPng: 'sample-image-small-two.png',
    sampleTextOne: 'sample-text-one.txt',
    sampleTextTwo: 'sample-text-two.txt'
  };

  beforeEach(function() {
    fixtures = {
      sampleImageSmallOnePng: 'sample-image-small-one.png',
      sampleImageSmallTwoPng: 'sample-image-small-two.png',
      sampleTextOne: 'sample-text-one.txt',
      sampleTextTwo: 'sample-text-two.txt'
    };
  });

  forEach(fixtures, function(value, key) {
    it('retrieves' + value, function() {
      var fixtures = {};
      fixtures[key] = value;
      return fh2.fetchFixtures(fixtures);
    });
  });

  it('retrieves all fixtures', function() {
    return fh2.fetchFixtures(fixtures);
  });
});
