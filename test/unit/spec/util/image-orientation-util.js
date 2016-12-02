var assert = require('chai').assert;
var fh2 = require('../../../integration/lib/fixtures-v2');
var ImageOrientationUtil = require('../../../../src/util/image-orientation-util');
var sinon = require('sinon');

describe('getExifData()', function() {
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
        url: 'https://beta.webex.com/files/api/v1/spaces/511192c2-7916-4299-a1b3-4194b62a…9c7-423e-992e-395584185faa/versions/0ad8714c2cc940bcb01eb08aa6aa0fe3/bytes',
        objectURL: 'blob:https://beta.webex.com/files/api/v1/spaces/6f452b94-9a83-43d9-ab05-0eb269da…a6a-4df7-9584-3c25df698a3d/versions/cc3945d2676b4055a1442b10c796761c/bytes',
        width: 362
      },
      mimeType: 'image/jpeg',
      objectType: 'file',
    };

    return fh2.fetchFixtures(fixtures)
      .then(function() {
        var f = fixtures.fixture;
        ImageOrientationUtil.getExifData(sampleFile, f)
          .then(function(res) {
            assert.equal(res, f);
            assert.equal(sampleFile.image.orientation, 7);
          });
      });
  });
});

describe('setImageOrientation()', function() {
  it('rotates/flips the image on the canvas as per exif information', /* eslint complexity: ["error", 9] */ function() {
    ImageOrientationUtil.drawImage = sinon.spy();
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
      ImageOrientationUtil.setImageOrientation(sampleImageOptions);
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
      assert(ImageOrientationUtil.drawImage.calledWith(image));
    }
  });
});
