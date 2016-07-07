'use strict';

var assert = require('chai').assert;
var fh2 = require('../../../lib/fixtures-v2');
var landingparty = require('../../../lib/landingparty');

describe('Services', function() {
  describe('Conversation', function() {
    describe('ShareActivity', function() {
      describe('#_processImage()', function() {
        this.timeout(10000);
        var fixtures = {
          png: 'sample-image-small-one.png',
          txt: 'sample-text-one.txt'
        };

        var party = {
          spock: true
        };

        var share;

        before(function() {
          return Promise.all([
            landingparty.beamDown(party),
            fh2.fetchFixtures(fixtures)
          ]);
        });

        beforeEach(function() {
          return party.spock.spark.conversation.createShareActivity({})
            .then(function(a) {
              share = a;
            });
        });

        it('resolves cleanly if the file is not an image', function() {
          return assert.becomes(share._processImage(fixtures.txt), undefined);
        });

        it('generates a thumbnail, encrypts the thumbnail, and computes image metadata', function() {
          return assert.isFulfilled(share._processImage(fixtures.png))
            .then(function(metadata) {
              assert.isDefined(metadata);

              assert.property(metadata, 'dimensions');
              assert.equal(metadata.dimensions.height, 16);
              assert.equal(metadata.dimensions.width, 16);

              assert.property(metadata, 'image');
              assert.equal(metadata.image.height, 16);
              assert.equal(metadata.image.width, 16);
              assert.property(metadata.image, 'scr');

              assert.property(metadata, 'thumbnailBlob');
            });
        });
      });
    });
  });
});
