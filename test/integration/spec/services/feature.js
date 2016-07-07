/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

/* eslint no-undef: [0] */

var chai = require('chai');
var assert = chai.assert;

var landingparty = require('../../lib/landingparty');

describe('Services', function() {
  this.timeout(60000);

  describe('Feature', function() {
    var party = {
      spock: true
    };

    before(function beamDown() {
      return landingparty.beamDown(party);
    });

    [
      'developer',
      'user'
    ].forEach(function(key) {
      describe('#setFeature()', function() {

        it('sets a value for a ' + key + ' feature toggle', function() {
          return party.spock.spark.feature.setFeature(key, 'testFeature', false)
            .then(function(res) {
              assert.equal(res.key, 'testFeature');
              assert.equal(res.val, 'false');
              assert.equal(res.value, false);
              assert.equal(res.type, 'boolean');

              assert.equal(party.spock.spark.device.features[key].get({key: 'testFeature'}).val, 'false');
              assert.equal(party.spock.spark.feature.getFeature(key, 'testFeature'), false);
            });
        });

      });
    });

  });
});
