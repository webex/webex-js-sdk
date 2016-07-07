/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

/* eslint no-undef: [0] */

var chai = require('chai');
var assert = chai.assert;

var landingparty = require('../../lib/landingparty');

describe('MediaCluster', function() {
  this.timeout(60000);

  describe('Feature', function() {
    var party = {
      spock: true
    };

    before(function beamDown() {
      return landingparty.beamDown(party);
    });

    before(function setFeature() {
      return party.spock.spark.feature.setFeature('developer', 'calliope-discovery', true);
    });

    describe('#setFeature()', function() {

      it('check media clusters present', function() {
        return party.spock.spark.device.refresh()
          .then(function() {
            assert.notEqual(party.spock.spark.device.mediaClusters.length, 0);
          });
      });
    });

  });
});
