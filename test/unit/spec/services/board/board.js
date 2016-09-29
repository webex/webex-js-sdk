/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var chai = require('chai');
var Board = require('../../../../../src/client/services/board');
var MockSpark = require('../../../lib/mock-spark');
var sinon = require('sinon');

var assert = chai.assert;
sinon.assert.expose(chai.assert, {prefix: ''});

describe('Services', function() {
  describe('Board', function() {
    var spark;
    var encryptedData = 'encryptedData';
    var decryptedText = 'decryptedText';
    var fakeURL = 'fakeURL';
    var file = 'dataURL://base64;';

    var conversation = {
      id: 'superUniqueId',
      defaultActivityEncryptionKeyUrl: fakeURL
    };

    before(function() {
      spark = new MockSpark({
        children: {
          board: Board
        },
        device: {
          deviceType: 'FAKE_DEVICE'
        },
        encryption: {
          decryptText: sinon.stub().returns(Promise.resolve(decryptedText)),
          encryptText: sinon.stub().returns(Promise.resolve(encryptedData)),
          encryptBinary: sinon.stub().returns(Promise.resolve({
            cblob: encryptedData,
            scr: {}
          })),
          download: sinon.stub().returns(Promise.resolve({
            toArrayBuffer: sinon.stub()
          })),
          decryptScr: sinon.stub().returns(Promise.resolve('decryptedFoo')),
          encryptScr: sinon.stub().returns(Promise.resolve('encryptedFoo'))
        },
        request: sinon.stub().returns(Promise.resolve()),
        client: {
          upload: sinon.stub().returns(Promise.resolve())
        }
      });
    });

    describe('#children', function() {

      it('has a child of persistence', function() {
        assert.isDefined(spark.board.persistence);
      });

      it('has a child of realtime', function() {
        assert.isDefined(spark.board.realtime);
      });
    });

    describe('#_uploadImage()', function() {

      before(function() {
        sinon.stub(spark.board, '_uploadImageToSparkFiles', sinon.stub().returns(Promise.resolve({
          downloadUrl: fakeURL
        })));
        return spark.board._uploadImage(conversation, file);
      });

      after(function() {
        spark.board._uploadImageToSparkFiles.restore();
      });

      it('encrypts binary file', function() {
        assert.calledWith(spark.encryption.encryptBinary, file);
      });

      it('uploads to spark files', function() {
        assert.calledWith(spark.board._uploadImageToSparkFiles, conversation, encryptedData);
      });
    });

    describe('#_uploadImageToSparkFiles()', function() {

      afterEach(function() {
        spark.client.upload.reset();
      });

      it('uses length for upload filesize', function() {
        var blob = {
          length: 4444,
          size: 3333,
          byteLength: 2222
        };

        return spark.board._uploadImageToSparkFiles(conversation, blob)
          .then(function() {
            assert.calledWith(spark.client.upload, sinon.match({
              phases: {
                initialize: {
                  fileSize: 4444
                },
                finalize: {
                  body: {
                    fileSize: 4444
                  }
                }
              }
            }));
          });
      });

      it('uses size for upload filesize when length is not available', function() {
        var blob = {
          size: 3333,
          byteLength: 2222
        };

        return spark.board._uploadImageToSparkFiles(conversation, blob)
          .then(function() {
            assert.calledWith(spark.client.upload, sinon.match({
              phases: {
                initialize: {
                  fileSize: 3333
                },
                finalize: {
                  body: {
                    fileSize: 3333
                  }
                }
              }
            }));
          });
      });

      it('uses byteLenght for upload filesize when length and size are not available', function() {
        var blob = {
          byteLength: 2222
        };

        return spark.board._uploadImageToSparkFiles(conversation, blob)
          .then(function() {
            assert.calledWith(spark.client.upload, sinon.match({
              phases: {
                initialize: {
                  fileSize: 2222
                },
                finalize: {
                  body: {
                    fileSize: 2222
                  }
                }
              }
            }));
          });
      });
    });

    describe('#encryptContents', function() {

      before(function() {
        sinon.stub(spark.board, 'encryptSingleContent').returns(Promise.resolve({
          encryptedData: encryptedData,
          encryptionKeyUrl: fakeURL
        }));
      });

      afterEach(function() {
        spark.board.encryptSingleContent.reset();
      });

      it('calls encryptSingleContent when type is not image', function() {

        var curveContents = [{
          type: 'curve'
        }];

        return spark.board.encryptContents(fakeURL, curveContents)
          .then(function() {
            assert.calledWith(spark.board.encryptSingleContent, fakeURL, curveContents[0]);
            assert.notCalled(spark.encryption.encryptScr);
          });
      });

      it('calls encryptText and encryptScr when scr is found in content', function() {

        var imageContents = [{
          displayName: 'FileName',
          scr: {
            loc: fakeURL
          }
        }];

        return spark.board.encryptContents(fakeURL, imageContents)
          .then(function() {
            assert.calledWith(spark.encryption.encryptScr, {loc: fakeURL}, fakeURL);
            assert.calledWith(spark.encryption.encryptText, 'FileName', fakeURL);
          });
      });

      it('sets the device to config deviceType', function() {
        var curveContents = [{
          type: 'curve'
        }];

        return spark.board.encryptContents(fakeURL, curveContents)
          .then(function(res) {
            assert.equal(res[0].device, 'FAKE_DEVICE');
          });
      });
    });

    describe('#decryptContents', function() {

      before(function() {
        sinon.stub(spark.board, 'decryptSingleContent', sinon.stub().returns(Promise.resolve({})));
      });

      after(function() {
        spark.board.decryptSingleContent.restore();
      });

      afterEach(function() {
        spark.board.decryptSingleContent.reset();
        spark.encryption.decryptScr.reset();
      });

      it('calls decryptSingleContent when type is not image', function() {

        var curveContents = {
          items: [{
            type: 'STRING',
            payload: encryptedData,
            encryptionKeyUrl: fakeURL
          }]
        };

        return spark.board.decryptContents(curveContents)
          .then(function() {
            assert.calledWith(spark.board.decryptSingleContent, encryptedData, fakeURL);
            assert.notCalled(spark.encryption.decryptScr);
            assert.notCalled(spark.encryption.decryptText);
          });
      });

      it('calls decryptSingleContent when type is FILE', function() {

        var imageContents = {
          items: [{
            type: 'FILE',
            payload: JSON.stringify({
              type: 'image',
              scr: 'encryptedScr',
              displayName: 'encryptedDisplayName'
            }),
            encryptionKeyUrl: fakeURL
          }]
        };

        return spark.board.decryptContents(imageContents)
          .then(function() {
            assert.calledWith(spark.encryption.decryptText, 'encryptedDisplayName', fakeURL);
            assert.calledWith(spark.encryption.decryptScr, 'encryptedScr', fakeURL);
          });
      });
    });

    describe('#parseLinkHeaders', function() {

      it('returns empty object if there are not any link headers', function() {
        var linkHeader = undefined;
        assert.deepEqual(spark.board.parseLinkHeaders(linkHeader), {});
      });

      it('returns object containing one link if only one link header passed as a string', function() {
        var linkHeader = '<https://www.cisco.com>; rel=cisco';
        assert.deepEqual(spark.board.parseLinkHeaders(linkHeader), {
          cisco: 'https://www.cisco.com'
        });
      });

      it('returns object containing multiple links when multiple headers passed as an array', function() {
        var linkHeader = [
          '<https://www.ciscospark.com>; rel=ciscospark',
          '<https://www.cisco.com>; rel=cisco'
        ];
        assert.deepEqual(spark.board.parseLinkHeaders(linkHeader), {
          ciscospark: 'https://www.ciscospark.com',
          cisco: 'https://www.cisco.com'
        });
      });
    });
  });
});
