/**!
*
* Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
*/

import {assert} from '@ciscospark/test-helper-chai';
import {fixImageOrientation, getExifData, setImageOrientation} from '../..';
import file from '@ciscospark/test-helper-file';
import {HttpError, request} from '../..';
import sinon from '@ciscospark/test-helper-sinon';
import {nodeOnly} from '@ciscospark/test-helper-mocha';
describe(`helper-image`, function() {
  this.timeout(30000);

  describe(`getExifData()`, () => {
    it(`adds exif orientation information on the image file`, () => {
      let sampleFile = {
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

      return file.fetch(`/Portrait_7.jpg`)
      .then((f) => {
        getExifData(sampleFile, f)
          .then(function(res) {
            assert.equal(res, f);
            assert.equal(sampleFile.image.orientation, 7);
          })
      });
    });
  });

  // describe(`setImageOrientation()`, () => {
  //   it(`rotates/flips the image on the canvas as per exif information`, () => {
  //     console.log('@@@@@@ imageOrientationUtil=', imageOrientationUtil);
  //     sinon.stub(imageOrientationUtil, `drawImage`, (image) => {
  //       console.log('@@@@@ inside the sinon function');
  //       return Promise.resolve(image);
  //     });
  //     const options = {
  //       img: 'Portrait_7.jpg',
  //       x: 0,
  //       y: 0,
  //       width: 362,
  //       height: 300,
  //       ctx: {},
  //       orientation: 7
  //     };
  //     setImageOrientation(options);
  //     assert(drawImage.called);
  //   });
  // });

});
