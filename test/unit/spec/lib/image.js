var assert = require('chai').assert;
var fh2 = require('../../../integration/lib/fixtures-v2');
var imageUtil = require('../../../../src/lib/image/');

describe('Util', function() {
  describe('image', function() {
    this.timeout(5000);
    var fixtures = {
      png: 'sample-image-small-one.png'
    };

    before(function() {
      return fh2.fetchFixtures(fixtures);
    });

    it('outputs same image size if it does not exceed max dimensions', function() {
      var metadata = {};
      assert.isFulfilled(imageUtil.processImage(fixtures.png, metadata))
        .then(function(thumbnail) {
          assert.isDefined(metadata);
          assert.isDefined(thumbnail);
          assert.property(metadata, 'dimensions');
          assert.equal(metadata.dimensions.height, 16);
          assert.equal(metadata.dimensions.width, 16);

          assert.property(metadata, 'image');
          assert.equal(metadata.image.height, 16);
          assert.equal(metadata.image.width, 16);
        });
    });

    it('resizes the image to a smaller size if max dimensions were exceeded', function() {
      var metadata = {};
      var options = {
        maxHeight: 15,
        maxWidth: 15
      };
      assert.isFulfilled(imageUtil.processImage(fixtures.png, metadata, options))
        .then(function(thumbnail) {
          assert.isDefined(metadata);
          assert.isDefined(thumbnail);
          assert.property(metadata, 'dimensions');
          assert.equal(metadata.dimensions.height, 16);
          assert.equal(metadata.dimensions.width, 16);

          assert.property(metadata, 'image');
          assert.equal(metadata.image.height, 15);
          assert.equal(metadata.image.width, 15);
        });
    });
  });
});
