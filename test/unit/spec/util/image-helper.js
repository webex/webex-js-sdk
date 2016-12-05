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
  ImageHelper.drawImage = sinon.spy();
  var sampleImageOptions = {
    img: 'SampleImage.jpg',
    x: 0,
    y: 0,
    width: 362,
    height: 300,
    ctx: {}
  };
  [1, 2, 3, 4, 5, 6, 7, ].forEach(function(orientation) {
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
    var msg;
    // just changing the orientation to make sure that the function is correctly processing the inputs
    sampleImageOptions.orientation = orientation;
    ImageHelper.orient(sampleImageOptions);
    switch(orientation) {
      case 2:
        msg = 'flipImage';
        break;
      case 3:
        msg = 'rotateImage180';
        image.deg = 180;
        image.flip = false;
        break;
      case 4:
        msg = 'rotate180AndFlipImage';
        image.deg = 180;
        image.flip = true;
        break;
      case 5:
        msg = 'rotate270AndFlipImage';
        image.deg = 270;
        image.flip = true;
        break;
      case 6:
        msg = 'rotateImage270';
        image.deg = 270;
        image.flip = false;
        break;
      case 7:
        msg = 'rotateNeg90AndFlipImage';
        image.deg = 90;
        image.flip = true;
        break;
      case 8:
        msg = 'rotateNeg90';
        image.deg = 90;
        image.flip = false;
        break;
      default:
        msg = 'do nothing';
        break;
    }
    assert(ImageHelper.drawImage.calledWith(image));
    it(msg + ' on the canvas if image orientation is ' + orientation, /* eslint complexity: ["error", 9] */ function() {});
  });
});
