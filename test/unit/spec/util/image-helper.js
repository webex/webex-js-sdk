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
  var events = [
    {
      orientation: 1,
      message: 'do nothing'
    },
    {
      orientation: 2,
      message: 'flipImage'
    },
    {
      orientation: 3,
      message: 'rotateImage180'
    },
    {
      orientation: 4,
      message: 'rotate180AndFlipImage'
    },
    {
      orientation: 5,
      message: 'rotate270AndFlipImage'
    },
    {
      orientation: 6,
      message: 'rotateImage270'
    },
    {
      orientation: 7,
      message: 'rotateNeg90AndFlipImage'
    },
    {
      orientation: 8,
      message: 'rotateNeg90'
    }
  ];
  var file = {
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
  var options = {
    img: 'SampleImage.jpg',
    x: 0,
    y: 0,
    width: 362,
    height: 300,
    ctx: {
      save: sinon.stub().returns(true),
      translate: sinon.stub().returns(true),
      rotate: sinon.stub().returns(true),
      scale: sinon.stub().returns(true),
      drawImage: sinon.stub().returns(true),
      restore: sinon.stub().returns(true)
    }
  };
  events.forEach(function(event) {
    describe('when an image file is received with image orientation as ' + event.orientation, function() {
      options.orientation = event.orientation;
      file.image.orientation = event.orientation;
      ImageHelper.orient(options, file);
      it(event.message + ' on the canvas', /* eslint complexity: ["error", 9] */ function() {
        switch (event.orientation) {
          case 2:
            assert.isTrue(options.ctx.save.called);
            assert.isTrue(options.ctx.translate.calledWith(options.x + options.width/2, options.y + options.height/2));
            assert.isTrue(options.ctx.drawImage.calledWith(options.img, -options.width/2, -options.height/2, options.width, options.height));
            assert.isTrue(options.ctx.restore.called);
            break;
          case 3:
            assert.isTrue(options.ctx.save.called);
            assert.isTrue(options.ctx.translate.calledWith(options.x + options.width/2, options.y + options.height/2));
            assert.isTrue(options.ctx.drawImage.calledWith(options.img, -options.width/2, -options.height/2, options.width, options.height));
            assert.isTrue(options.ctx.restore.called);
            assert.isTrue(options.ctx.rotate.calledWith(2*Math.PI - 180*Math.PI/180));
            break;
          case 4:
            assert.isTrue(options.ctx.save.called);
            assert.isTrue(options.ctx.translate.calledWith(options.x + options.width/2, options.y + options.height/2));
            assert.isTrue(options.ctx.drawImage.calledWith(options.img, -options.width/2, -options.height/2, options.width, options.height));
            assert.isTrue(options.ctx.restore.called);
            assert.isTrue(options.ctx.rotate.calledWith(180*Math.PI/180));
            assert.isTrue(options.ctx.scale.calledWith(-1, 1));
            break;
          case 5:
            assert.isTrue(options.ctx.save.called);
            assert.isTrue(options.ctx.translate.calledWith(options.x + options.width/2, options.y + options.height/2));
            assert.isTrue(options.ctx.drawImage.calledWith(options.img, -options.width/2, -options.height/2, options.width, options.height));
            assert.isTrue(options.ctx.restore.called);
            assert.isTrue(options.ctx.rotate.calledWith(270*Math.PI/180));
            assert.isTrue(options.ctx.scale.calledWith(-1, 1));
            break;
          case 6:
            assert.isTrue(options.ctx.save.called);
            assert.isTrue(options.ctx.translate.calledWith(options.x + options.width/2, options.y + options.height/2));
            assert.isTrue(options.ctx.drawImage.calledWith(options.img, -options.width/2, -options.height/2, options.width, options.height));
            assert.isTrue(options.ctx.restore.called);
            assert.isTrue(options.ctx.rotate.calledWith(2*Math.PI - 270*Math.PI/180));
            break;
          case 7:
            assert.isTrue(options.ctx.save.called);
            assert.isTrue(options.ctx.translate.calledWith(options.x + options.width/2, options.y + options.height/2));
            assert.isTrue(options.ctx.drawImage.calledWith(options.img, -options.width/2, -options.height/2, options.width, options.height));
            assert.isTrue(options.ctx.restore.called);
            assert.isTrue(options.ctx.rotate.calledWith(90*Math.PI/180));
            assert.isTrue(options.ctx.scale.calledWith(-1, 1));
            break;
          case 8:
            assert.isTrue(options.ctx.save.called);
            assert.isTrue(options.ctx.translate.calledWith(options.x + options.width/2, options.y + options.height/2));
            assert.isTrue(options.ctx.drawImage.calledWith(options.img, -options.width/2, -options.height/2, options.width, options.height));
            assert.isTrue(options.ctx.restore.called);
            assert.isTrue(options.ctx.rotate.calledWith(2*Math.PI - 90*Math.PI/180));
            break;
          default:
            break;
        }
      });
    });
  });
});
