/**!
*
* Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
*/

import {assert} from '@ciscospark/test-helper-chai';
import {readExifData, orient} from '../..';
import file from '@ciscospark/test-helper-file';
import sinon from '@ciscospark/test-helper-sinon';
describe(`helper-image`, () => {
  describe(`readExifData()`, () => {
    it(`adds exif orientation information on the image file`, () => {
      const sampleFile = {
        displayName: `Portrait_7.jpg`,
        fileSize: 405822,
        type: `image/jpeg`,
        image: {
          height: 300,
          width: 362
        },
        mimeType: `image/jpeg`,
        objectType: `file`
      };

      return file.fetch(`/Portrait_7.jpg`)
      .then((f) => {
        readExifData(sampleFile, f)
        .then((res) => {
          assert.equal(res, f);
          assert.equal(sampleFile.image.orientation, 7);
        });
      });
    });
  });

  describe(`orient()`, () => {
    const events = [
      {
        orientation: 1,
        message: `do nothing`
      },
      {
        orientation: 2,
        message: `flipImage`
      },
      {
        orientation: 3,
        message: `rotateImage180`
      },
      {
        orientation: 4,
        message: `rotate180AndFlipImage`
      },
      {
        orientation: 5,
        message: `rotate270AndFlipImage`
      },
      {
        orientation: 6,
        message: `rotateImage270`
      },
      {
        orientation: 7,
        message: `rotateNeg90AndFlipImage`
      },
      {
        orientation: 8,
        message: `rotateNeg90`
      }
    ];
    const file = {
      displayName: `Portrait_7.jpg`,
      fileSize: 405822,
      type: `image/jpeg`,
      image: {
        height: 300,
        width: 362
      },
      mimeType: `image/jpeg`,
      objectType: `file`
    };
    const options = {
      img: `Portrait_7.jpg`,
      x: 0,
      y: 0,
      width: 362,
      height: 300,
      ctx: {
        save: sinon.stub().returns(() => true),
        translate: sinon.stub().returns(() => true),
        rotate: sinon.stub().returns(() => true),
        scale: sinon.stub().returns(() => true),
        drawImage: sinon.stub().returns(() => true),
        restore: sinon.stub().returns(() => true)
      }
    };
    events.forEach(/* eslint complexity: ["error", 9] */ (def) => {
      const {message, orientation} = def;
      describe(`when an image file is received with image orientation as ${orientation}`, () => {
        options.orientation = orientation;
        file.image.orientation = orientation;
        orient(options, file);
        it(`${message} on the canvas`, /* eslint no-empty-function: 0 */ () => {
          switch (orientation) {
          case 2:
            assert.isTrue(options.ctx.save.called);
            assert.isTrue(options.ctx.translate.calledWith(options.x + options.width / 2, options.y + options.height / 2));
            assert.isTrue(options.ctx.drawImage.calledWith(options.img, -options.width / 2, -options.height / 2, options.width, options.height));
            assert.isTrue(options.ctx.restore.called);
            break;
          case 3:
            assert.isTrue(options.ctx.save.called);
            assert.isTrue(options.ctx.translate.calledWith(options.x + options.width / 2, options.y + options.height / 2));
            assert.isTrue(options.ctx.drawImage.calledWith(options.img, -options.width / 2, -options.height / 2, options.width, options.height));
            assert.isTrue(options.ctx.restore.called);
            assert.isTrue(options.ctx.rotate.calledWith(2 * Math.PI - 180 * Math.PI / 180));
            break;
          case 4:
            assert.isTrue(options.ctx.save.called);
            assert.isTrue(options.ctx.translate.calledWith(options.x + options.width / 2, options.y + options.height / 2));
            assert.isTrue(options.ctx.drawImage.calledWith(options.img, -options.width / 2, -options.height / 2, options.width, options.height));
            assert.isTrue(options.ctx.restore.called);
            assert.isTrue(options.ctx.rotate.calledWith(180 * Math.PI / 180));
            assert.isTrue(options.ctx.scale.calledWith(-1, 1));
            break;
          case 5:
            assert.isTrue(options.ctx.save.called);
            assert.isTrue(options.ctx.translate.calledWith(options.x + options.width / 2, options.y + options.height / 2));
            assert.isTrue(options.ctx.drawImage.calledWith(options.img, -options.width / 2, -options.height / 2, options.width, options.height));
            assert.isTrue(options.ctx.restore.called);
            assert.isTrue(options.ctx.rotate.calledWith(270 * Math.PI / 180));
            assert.isTrue(options.ctx.scale.calledWith(-1, 1));
            break;
          case 6:
            assert.isTrue(options.ctx.save.called);
            assert.isTrue(options.ctx.translate.calledWith(options.x + options.width / 2, options.y + options.height / 2));
            assert.isTrue(options.ctx.drawImage.calledWith(options.img, -options.width / 2, -options.height / 2, options.width, options.height));
            assert.isTrue(options.ctx.restore.called);
            assert.isTrue(options.ctx.rotate.calledWith(2 * Math.PI - 270 * Math.PI / 180));
            break;
          case 7:
            assert.isTrue(options.ctx.save.called);
            assert.isTrue(options.ctx.translate.calledWith(options.x + options.width / 2, options.y + options.height / 2));
            assert.isTrue(options.ctx.drawImage.calledWith(options.img, -options.width / 2, -options.height / 2, options.width, options.height));
            assert.isTrue(options.ctx.restore.called);
            assert.isTrue(options.ctx.rotate.calledWith(90 * Math.PI / 180));
            assert.isTrue(options.ctx.scale.calledWith(-1, 1));
            break;
          case 8:
            assert.isTrue(options.ctx.save.called);
            assert.isTrue(options.ctx.translate.calledWith(options.x + options.width / 2, options.y + options.height / 2));
            assert.isTrue(options.ctx.drawImage.calledWith(options.img, -options.width / 2, -options.height / 2, options.width, options.height));
            assert.isTrue(options.ctx.restore.called);
            assert.isTrue(options.ctx.rotate.calledWith(2 * Math.PI - 90 * Math.PI / 180));
            break;
          default:
            break;
          }
        });
      });
    });
  });
});
