/**!
*
* Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
*/

import {assert} from '@ciscospark/test-helper-chai';
import {readExifData, orient} from '../..';
import file from '@ciscospark/test-helper-file';
import sinon from '@ciscospark/test-helper-sinon';
describe(`helper-image`, function() {
  this.timeout(30000);

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
    [1, 2, 3, 4, 5, 6, 7, 8].forEach(/* eslint complexity: ["error", 9] */ (orientation) => {
      let msg;
      options.orientation = orientation;
      orient(options);
      assert.isTrue(options.ctx.save.called);
      assert.isTrue(options.ctx.translate.calledWith(options.x + options.width / 2, options.y + options.height / 2));
      assert.isTrue(options.ctx.drawImage.calledWith(options.img, -options.width / 2, -options.height / 2, options.width, options.height));
      assert.isTrue(options.ctx.restore.called);
      switch (orientation) {
      case 2:
        msg = `flipImage`;
        break;
      case 3:
        msg = `rotateImage180`;
        assert.isTrue(options.ctx.rotate.calledWith(2 * Math.PI - 180 * Math.PI / 180));
        break;
      case 4:
        msg = `rotate180AndFlipImage`;
        assert.isTrue(options.ctx.rotate.calledWith(180 * Math.PI / 180));
        assert.isTrue(options.ctx.scale.calledWith(-1, 1));
        break;
      case 5:
        msg = `rotate270AndFlipImage`;
        assert.isTrue(options.ctx.rotate.calledWith(270 * Math.PI / 180));
        assert.isTrue(options.ctx.scale.calledWith(-1, 1));
        break;
      case 6:
        msg = `rotateImage270`;
        assert.isTrue(options.ctx.rotate.calledWith(2 * Math.PI - 270 * Math.PI / 180));
        break;
      case 7:
        msg = `rotateNeg90AndFlipImage`;
        assert.isTrue(options.ctx.rotate.calledWith(90 * Math.PI / 180));
        assert.isTrue(options.ctx.scale.calledWith(-1, 1));
        break;
      case 8:
        msg = `rotateNeg90`;
        assert.isTrue(options.ctx.rotate.calledWith(2 * Math.PI - 90 * Math.PI / 180));
        break;
      default:
        msg = `do nothing`;
        break;
      }
      it(`${msg} on the canvas if image orientation is ${orientation}`, /* eslint no-empty-function: 0 */ () => {});
    });
  });

});
