/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import {readExifData, updateImageOrientation} from '@webex/helper-image';
import {orient} from './../../../src/orient';
import fileHelper from '@webex/test-helper-file';
import sinon from 'sinon';
import {browserOnly, nodeOnly} from '@webex/test-helper-mocha';

describe('helper-image', () => {
  // TODO: https://jira-eng-gpk2.cisco.com/jira/browse/SPARK-326189
  xdescribe('readExifData()', () => {
    let buffer;

    browserOnly(beforeAll)(() => fileHelper.fetch('/Portrait_7.jpg')
      .then((resFile) => {
        /* global FileReader */
        const fileReader = new FileReader();

        fileReader.readAsArrayBuffer(resFile);

        return new Promise((resolve) => {
          fileReader.onload = function () {
            buffer = Buffer.from(fileReader.result);
            resolve();
          };
        });
      })
    );

    nodeOnly(beforeAll)(() => fileHelper.fetch('/Portrait_7.jpg')
      .then((resFile) => {
        buffer = resFile;
      })
    );

    it('adds exif orientation information on the image file', () => {
      const sampleFile = {
        displayName: 'Portrait_7.jpg',
        fileSize: 405822,
        type: 'image/jpeg',
        image: {
          height: 300,
          width: 362,
        },
        mimeType: 'image/jpeg',
        objectType: 'file',
      };

      return readExifData(sampleFile, buffer).then((res) => {
        assert.equal(res, buffer);
        assert.equal(sampleFile.orientation, 7);
      });
    });

    it('adds replaces height/width with exif height/width information', () => {
      const sampleFile = {
        displayName: 'Portrait_7.jpg',
        fileSize: 405822,
        type: 'image/jpeg',
        image: {
          height: 300,
          width: 362,
        },
        mimeType: 'image/jpeg',
        objectType: 'file',
      };

      return readExifData(sampleFile, buffer).then((res) => {
        assert.equal(res, buffer);
        assert.equal(sampleFile.orientation, 7);
        assert.equal(sampleFile.exifHeight, 450);
        assert.equal(sampleFile.exifWidth, 600);
      });
    });
  });

  browserOnly(describe)('updateImageOrientation()', () => {
    let file;

    beforeAll(() => fileHelper.fetch('/Portrait_7.jpg')
      .then((resFile) => {
        file = resFile;
        file.displayName = 'Portrait_7.jpg';
        file.mimeType = 'image/jpeg';
      })
    );

    it('does not add exif data on image file', () =>
      updateImageOrientation(file, {shouldNotAddExifData: true})
        .then((res) => {
          assert.equal(file.orientation, undefined);

          return fileHelper.isMatchingFile(res, file);
        })
        .then((result) => assert.isTrue(result)));

    it('adds exif data on the image file', () =>
      updateImageOrientation(file)
        .then((res) => {
          assert.equal(file.orientation, 7);

          return fileHelper.isMatchingFile(res, file);
        })
        .then((result) => assert.isTrue(result)));
  });

  describe('orient()', () => {
    const file = {
      displayName: 'Portrait_7.jpg',
      fileSize: 405822,
      type: 'image/jpeg',
      image: {
        height: 300,
        width: 362,
      },
      mimeType: 'image/jpeg',
      objectType: 'file',
    };
    const options = {
      img: 'Portrait_7.jpg',
      x: 0,
      y: 0,
      width: 362,
      height: 300,
      ctx: {
        save: sinon.stub().returns(() => true),
        translate: sinon.stub().returns(() => true),
        rotate: sinon.stub().returns(() => true),
        transform: sinon.stub().returns(() => true),
        scale: sinon.stub().returns(() => true),
        drawImage: sinon.stub().returns(() => true),
        restore: sinon.stub().returns(() => true),
      },
    };
    const {height, width} = options;
    const events = [
      {
        orientation: 1,
      },
      {
        orientation: 2,
        flip: true,
        transform: [-1, 0, 0, 1, width, 0],
      },
      {
        orientation: 3,
        rotate: '180',
        transform: [-1, 0, 0, -1, width, height],
      },
      {
        orientation: 4,
        flip: true,
        rotate: '180',
        transform: [1, 0, 0, -1, 0, height],
      },
      {
        orientation: 5,
        flip: true,
        rotate: '270',
        transform: [0, 1, 1, 0, 0, 0],
      },
      {
        orientation: 6,
        rotate: '270',
        transform: [0, 1, -1, 0, height, 0],
      },
      {
        orientation: 7,
        flip: true,
        rotate: '90',
        transform: [0, -1, -1, 0, height, width],
      },
      {
        orientation: 8,
        rotate: '90',
        transform: [0, -1, 1, 0, 0, width],
      },
    ];

    events.forEach((def) => {
      const {flip, orientation, rotate, transform} = def;

      describe(`when an image file is received with orientation as ${orientation}`, () => {
        options.orientation = orientation;
        file.orientation = orientation;
        orient(options, file);
        let message = flip ? 'flips ' : '';

        message += rotate ? `rotates ${rotate} deg` : '';
        message = message ? `image on the canvas ${message}` : 'does nothing ';
        it(`${message}`, () => {
          if (transform) {
            assert.isTrue(options.ctx.transform.calledWith(...transform));
          }
          assert.isTrue(
            options.ctx.drawImage.calledWith(options.img, options.x, options.y, width, height)
          );
        });
      });
    });
  });
});
