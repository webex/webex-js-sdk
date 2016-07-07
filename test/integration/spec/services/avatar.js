/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var chai = require('chai');
var fh2 = require('../../lib/fixtures-v2');
var landingparty = require('../../lib/landingparty');
var sinon = require('sinon');

var assert = require('chai').assert;
sinon.assert.expose(chai.assert, {prefix: ''});

describe('Services', function() {
  describe('Avatar', function() {
    this.timeout(120000);

    var party = {
      spock: true,
      mccoy: true
    };

    var files = {
      sampleImageSmallOnePng: 'sample-image-small-one.png'
    };

    before(function beamDown() {
      return landingparty.beamDown(party);
    });

    before(function fetchFixtures() {
      return fh2.fetchFixtures(files);
    });

    describe('#setAvatar()', function() {
      it('sets a user\'s avatar', function() {
        return party.spock.spark.avatar.setAvatar(files.sampleImageSmallOnePng)
          .then(function(avatarUrl) {
            // Note: not downloading the avatar because rackspace CDN is too flaky
            assert.isDefined(avatarUrl);
            assert.match(avatarUrl, /^https?\:\/\//);
          });
      });

      it('invalidates current user\'s cached avatar after uploading a new one', function() {
        party.spock.spark.avatar.store.remove = sinon.spy();
        return party.spock.spark.avatar.setAvatar(files.sampleImageSmallOnePng)
          .then(function() {
            assert.calledWith(party.spock.spark.avatar.store.remove, party.spock.spark.device.userId);
          });
      });
    });

    describe('#retrieveAvatarUrl()', function() {
      before(function() {
        return Promise.all([
          party.spock.spark.avatar.setAvatar(files.sampleImageSmallOnePng),
          party.mccoy.spark.avatar.setAvatar(files.sampleImageSmallOnePng)
        ]);
      });

      it('retrieves an avatar url by email address', function() {
        return party.spock.spark.avatar.retrieveAvatarUrl(party.spock.email)
          .then(function(avatarUrl) {
            // Note: not downloading the avatar because rackspace CDN is too flaky
            assert.isDefined(avatarUrl);
            assert.match(avatarUrl, /^https?\:\/\//);
          });
      });

      it('retrieves an avatar url by uuid', function() {
        return party.spock.spark.avatar.retrieveAvatarUrl(party.mccoy.spark.device.userId)
          .then(function(avatarUrl) {
            // Note: not downloading the avatar because rackspace CDN is too flaky
            assert.isDefined(avatarUrl);
            assert.match(avatarUrl, /^https?\:\/\//);
          });
      });
    });
  });
});
