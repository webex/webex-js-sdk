var assert = require('chai').assert;
var fh2 = require('../../../integration/lib/fixtures-v2');
var ImageHelper = require('../../../../src/util/image-helper');
var sinon = require('sinon');

describe('readExifData()', function() {
  it('adds exif orientation information on the image file', function() {
    var fixtures = {
      fixture: 'Portrait_7.jpg'
    };

    var sampleFile = {
      displayName: 'Portrait_7.jpg',
      fileSize: 405822,
      type: 'image/jpeg',
      image: {
        height: 300,
        width: 362
      },
      mimeType: 'image/jpeg',
      objectType: 'file',
    };

    return fh2.fetchFixtures(fixtures)
      .then(function() {
        var f = fixtures.fixture;
        ImageHelper.readExifData(sampleFile, f)
          .then(function(res) {
            assert.equal(res, f);
            assert.equal(sampleFile.image.orientation, 7);
          });
      });
  });
});

describe('orient()', function() {
  it('rotates/flips the image on the canvas as per exif information', /* eslint complexity: ["error", 9] */ function() {
    ImageHelper.drawImage = sinon.spy();
    var sampleImageOptions = {
      img: 'SampleImage.jpg',
      x: 0,
      y: 0,
      width: 362,
      height: 300,
      ctx: {}
    };

    for (var index=3; index<=8; index++) {
      // just changing the orientation to make sure that the function is correctly processing the inputs
      sampleImageOptions.orientation = index;
      ImageHelper.orient(sampleImageOptions);
      var image = {
        img: sampleImageOptions.img,
        x: 0,
        y: 0,
        width: sampleImageOptions.width,
        height: sampleImageOptions.height,
        deg: 0,
        flip: true,
        ctx: sampleImageOptions.ctx
      };

      switch(index) {
        case 3:
          image.deg = 180;
          image.flip = false;
          break;
        case 4:
          image.deg = 180;
          image.flip = true;
          break;
        case 5:
          image.deg = 270;
          image.flip = true;
          break;
        case 6:
          image.deg = 270;
          image.flip = false;
          break;
        case 7:
          image.deg = 90;
          image.flip = true;
          break;
        case 8:
          image.deg = 90;
          image.flip = false;
          break;
      }
      assert(ImageHelper.drawImage.calledWith(image));
    }
  });
});
