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
      orientation: 1
    },
    {
      orientation: 2,
      flip: true,
    },
    {
      orientation: 3,
      rotate: '180'
    },
    {
      orientation: 4,
      flip: true,
      rotate: '180'
    },
    {
      orientation: 5,
      flip: true,
      rotate: '270'
    },
    {
      orientation: 6,
      rotate: '270'
    },
    {
      orientation: 7,
      flip: true,
      rotate: '90'
    },
    {
      orientation: 8,
      rotate: '90'
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
    describe('when an image file is received with orientation as ' + event.orientation, function() {
      options.orientation = event.orientation;
      file.image.orientation = event.orientation;
      ImageHelper.orient(options, file);
      var message = event.flip ? 'flips ' : '';
      message += event.rotate ? 'rotates ' + event.rotate + ' deg' : '';
      message = message ? 'canvas ' + message : 'does nothing ';
      it(message, function() {
        assert.isTrue(options.ctx.save.called);
        assert.isTrue(options.ctx.translate.calledWith(options.x + options.width / 2, options.y + options.height / 2));
        assert.isTrue(options.ctx.drawImage.calledWith(options.img, -options.width / 2, -options.height / 2, options.width, options.height));
        assert.isTrue(options.ctx.restore.called);
        if (event.flip) {
          assert.isTrue(options.ctx.scale.calledWith(-1, 1));
          if (event.rotate) {
            assert.isTrue(options.ctx.rotate.calledWith(event.rotate * Math.PI / 180));
          }
        }
        else if (event.rotate) {
          assert.isTrue(options.ctx.rotate.calledWith(2 * Math.PI - 90 * Math.PI / 180));
        }
      });
    });
  });
});
