'use strict';

var assert = require('chai').assert;
var fh2 = require('../../lib/fixtures-v2');
var landingparty = require('../../lib/landingparty');

describe('Service', function() {
  describe('Support', function() {
    describe('#submitCallLogs()', function() {
      this.timeout(20000);
      var fixtures = {
        sampleTextOne: 'sample-text-one.txt'
      };

      var party = {
        spock: true
      };

      before(function() {
        return fh2.fetchFixtures(fixtures);
      });

      before(function beamDown() {
        return landingparty.beamDown(party);
      });

      it('uploads call logs @atlas', function() {
        return party.spock.spark.support.submitCallLogs({}, fixtures.sampleTextOne);
      });

    });

    describe('#submitCallLogsForUnAuthUser()', function() {
      this.timeout(20000);
      var fixtures = {
        sampleTextOne: 'sample-text-one.txt'
      };

      var party = {
        spock: true
      };

      before(function() {
        return fh2.fetchFixtures(fixtures);
      });

      before(function beamDown() {
        return landingparty.beamDown(party);
      });

      it('uploads call logs @atlas and returns the userId', function() {
        return party.spock.spark.support.submitCallLogsForUnAuthUser({}, fixtures.sampleTextOne)
          .then(function(body) {
            assert.isDefined(body);
            assert.isDefined(body.url);
            assert.isDefined(body.userId);
          });
      });

    });

  });
});
