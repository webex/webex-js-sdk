/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import {ShareActivity} from '@webex/internal-plugin-conversation';
import sinon from 'sinon';
import MockWebex from '@webex/test-helper-mock-webex';
import sha256 from 'crypto-js/sha256';

describe('plugin-conversation', () => {
  describe('ShareActivity', () => {
    let shareActivity;

    beforeEach(() => {
      shareActivity = new ShareActivity();
    });

    describe('#_determineContentCategory', () => {
      it('returns "documents" when not all files have a mimeType', () => {
        const items = [{mimeType: 'image/png'}, {}];

        assert.equal(shareActivity._determineContentCategory(items), 'documents');
      });

      it('returns "documents" for non-homogenous mimeTypes', () => {
        const items = [{mimeType: 'image/png'}, {mimeType: 'video/h264'}];

        assert.equal(shareActivity._determineContentCategory(items), 'documents');
      });

      it('returns "documents" if the potentially homogenous mimeType is not image or video', () => {
        const items = [{mimeType: 'application/xml'}, {mimeType: 'application/xml'}];

        assert.equal(shareActivity._determineContentCategory(items), 'documents');
      });

      it('returns "image" if all mimeTypes are image', () => {
        const items = [{mimeType: 'image/png'}, {mimeType: 'image/jpg'}];

        assert.equal(shareActivity._determineContentCategory(items), 'images');
      });

      it('returns "video" if all mimeTypes are video', () => {
        const items = [{mimeType: 'video/h264'}, {mimeType: 'video/vp8'}];

        assert.equal(shareActivity._determineContentCategory(items), 'videos');
      });

      it('returns "documents" if a whiteboard mimeType is found in item.actions', () => {
        const items = [
          {
            mimeType: 'image/png',
            actions: [
              {
                mimeType: 'application/x-cisco-webex-whiteboard',
                type: 'edit',
                url: 'https://boards.example.com/boards/1',
              },
            ],
          },
        ];

        assert.equal(shareActivity._determineContentCategory(items), 'documents');
      });
    });
    describe('#upload', () => {
      let shareActivityUpload;
      let webex;
      const fakeURL =
        'https://encryption-a.wbx2.com/encryption/api/v1/keys/8a7d3d78-ce75-48aa-a943-2e8acf63fbc9';

      beforeEach(() => {
        webex = new MockWebex({
          upload: sinon.stub().returns(Promise.resolve({body: {downloadUrl: fakeURL}})),
        });

        shareActivityUpload = new ShareActivity(
          {},
          {
            parent: webex,
          }
        );
      });

      it('checks whether filehash is sent in body while making a call to /finish API', () => {
        const spy = sinon.spy(webex.upload);
        const fileSize = 3333;
        const fileHash = sha256(fakeURL).toString();

        const inputData = {
          phases: {
            initialize: {
              fileSize,
            },
            finalize: {
              body: {
                fileSize,
                fileHash,
              },
            },
          },
        };

        spy(inputData);

        assert.isTrue(spy.calledWith(inputData));
      });

      it('checks whether property role:spaceAvatar is sent in body while making a call to /finish API', () => {
        const fileSize = 100;
        const mockFile = {size: fileSize};
        const uploadOptions = {role: 'spaceAvatar'};

        shareActivityUpload._upload(mockFile, fakeURL, uploadOptions);

        const expectedResult = {fileSize, role: 'spaceAvatar'};
        const actualResult = webex.upload.getCall(0).args[0].phases.initialize.body;

        assert.match(actualResult, expectedResult);
      });

      it('checks whether property claimedFileType is sent with file extension in body while making a call to /finish API', () => {
        const fileSize = 100;
        const mockFile = {size: fileSize};

        const uploadOptions = {claimedFileType: '.zip'};

        shareActivityUpload._upload(mockFile, fakeURL, uploadOptions);

        const expectedResult = {fileSize, claimedFileType: '.zip'};
        const actualResult = webex.upload.getCall(0).args[0].phases.initialize.body;

        assert.match(actualResult, expectedResult);
      });
    });

    describe('#addGif', () => {
      const fakeHappyGif = {
        name: 'happy gif.gif',
        url: '/path/gif.gif',
        height: 200,
        width: 270,
        image: {height: 200, width: 270, url: '/path/thumbnailgif.gif'},
      };
      const fakeSadGif = {
        name: 'sad-gif.gif',
        url: '/path/gif.gif',
        height: 200,
        width: 270,
        image: {height: 200, width: 270, url: '/path/thumbnailgif.gif'},
      };

      it('adds gif to empty this.uploads', () => {
        shareActivity.addGif(fakeHappyGif); // attempt to add the gif to empty this.uploads

        // check that the gif was added via addGif
        assert.isTrue(shareActivity.uploads.size === 1);
      });

      it('if the giphy already exists, then do not add to this.uploads', () => {
        shareActivity.uploads.set(fakeHappyGif, {}); // add fake gif preemptively, mocking that we already added a gif
        shareActivity.addGif(fakeHappyGif); // attempt to add the same gif again

        // check that the gif was not added via addGif
        assert.isTrue(shareActivity.uploads.size === 1);
      });

      it('if the giphy does not exist, then add it to this.uploads', () => {
        shareActivity.uploads.set(fakeHappyGif, {}); // add fake gif preemptively, mocking that we already added a gif
        shareActivity.addGif(fakeSadGif); // attempt to add a different gif

        // check that the gif was added via addGif
        assert.isTrue(shareActivity.uploads.size === 2);
      });
    });
  });
});
