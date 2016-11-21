/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@ciscospark/test-helper-chai';
import MockSpark from '@ciscospark/test-helper-mock-spark';
import sinon from '@ciscospark/test-helper-sinon';
import Board, {config as boardConfig} from '../..';

describe(`plugin-board`, () => {
  let spark;
  const encryptedData = `encryptedData`;
  const decryptedText = `decryptedText`;
  const fakeURL = `fakeURL`;
  const file = `dataURL://base64;`;
  const boardServiceUrl = `https://awesome.service.url`;
  const boardId = `boardId`;

  const conversation = {
    id: `superUniqueId`,
    defaultActivityEncryptionKeyUrl: fakeURL
  };

  const channel = {
    channelUrl: `${boardServiceUrl}/channels/${boardId}`
  };

  const data1 = {
    contentUrl: `${channel.channelUrl}/contents/data1`,
    contentId: `data1`,
    type: `test`,
    data: `data1`
  };

  const data2 = {
    type: `test`,
    data: `data2`
  };

  before(() => {
    spark = new MockSpark({
      children: {
        board: Board
      },
      device: {
        deviceType: `FAKE_DEVICE`,
        getServiceUrl: () => {
          return boardServiceUrl;
        }
      },
      encryption: {
        decryptText: sinon.stub().returns(Promise.resolve(decryptedText)),
        encryptText: sinon.stub().returns(Promise.resolve(encryptedData)),
        encryptBinary: sinon.stub().returns(Promise.resolve({
          scr: {},
          cdata: encryptedData
        })),
        download: sinon.stub().returns(Promise.resolve({
          toArrayBuffer: sinon.stub()
        })),
        decryptScr: sinon.stub().returns(Promise.resolve(`decryptedFoo`)),
        encryptScr: sinon.stub().returns(Promise.resolve(`encryptedFoo`))
      },
      request: sinon.stub().returns(Promise.resolve({
        headers: {},
        body: ``
      })),
      upload: sinon.stub().returns(Promise.resolve({body: {downloadUrl: fakeURL}}))
    });
    spark.config.board = boardConfig.board;
  });

  describe(`#addContent()`, () => {

    beforeEach(() => {
      spark.request.reset();
    });

    it(`requests POST all contents to contents`, () => {
      return spark.board.addContent(conversation, channel, [data1, data2])
        .then(() => {
          assert.calledWith(spark.request, sinon.match({
            method: `POST`,
            uri: `${boardServiceUrl}/channels/${boardId}/contents`,
            body: [{
              device: `FAKE_DEVICE`,
              type: `STRING`,
              encryptionKeyUrl: `fakeURL`,
              payload: `encryptedData`
            }, {
              device: `FAKE_DEVICE`,
              type: `STRING`,
              encryptionKeyUrl: `fakeURL`,
              payload: `encryptedData`
            }]
          }));
        });
    });

    it(`sends large data using multiple requests`, () => {
      const largeData = [];

      for (let i = 0; i < 400; i++) {
        largeData.push({data: i});
      }

      return spark.board.addContent(conversation, channel, largeData)
        .then(() => {
          assert.equal(spark.request.callCount, 3);
        });
    });
  });

  describe(`#createChannel()`, () => {

    before(() => {
      spark.request.reset();
      return spark.board.createChannel({aclUrl: `foo`});
    });

    it(`requests POST to channels service`, () => {
      assert.calledWith(spark.request, sinon.match({
        method: `POST`,
        api: `board`,
        resource: `/channels`,
        body: {
          aclUrl: `foo`
        }
      }));
    });
  });

  describe(`#deleteContent()`, () => {

    before(() => {
      spark.request.reset();
      return spark.board.deleteContent(channel, data1);
    });

    it(`requests DELETE content`, () => {
      assert.calledWith(spark.request, sinon.match({
        method: `DELETE`,
        uri: `${boardServiceUrl}/channels/${boardId}/contents/${data1.contentId}`
      }));
    });
  });

  describe(`#deleteAllContent()`, () => {

    before(() => {
      spark.request.reset();
      return spark.board.deleteAllContent(channel);
    });

    it(`requests DELETE contents`, () => {
      assert.calledWith(spark.request, sinon.match({
        method: `DELETE`,
        uri: `${boardServiceUrl}/channels/${boardId}/contents`
      }));
    });
  });

  describe(`#_uploadImage()`, () => {

    before(() => {
      sinon.stub(spark.board, `_uploadImageToSparkFiles`).returns(Promise.resolve({
        downloadUrl: fakeURL
      }));
      return spark.board._uploadImage(conversation, file);
    });

    after(() => {
      spark.board._uploadImageToSparkFiles.restore();
    });

    it(`encrypts binary file`, () => {
      assert.calledWith(spark.encryption.encryptBinary, file);
    });

    it(`uploads to spark files`, () => {
      assert.calledWith(spark.board._uploadImageToSparkFiles, conversation, encryptedData);
    });
  });

  describe(`#_uploadImageToSparkFiles()`, () => {

    before(() => {
      sinon.stub(spark.board, `_getSpaceUrl`).returns(Promise.resolve(fakeURL));
      return spark.board._uploadImage(conversation, file);
    });

    after(() => spark.board._getSpaceUrl.restore());

    afterEach(() => {
      spark.upload.reset();
      spark.board._getSpaceUrl.reset();
    });


    it(`uses length for upload filesize`, () => {
      const blob = {
        length: 4444,
        size: 3333,
        byteLength: 2222
      };

      return spark.board._uploadImageToSparkFiles(conversation, blob)
        .then(() => {
          assert.calledWith(spark.upload, sinon.match({
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

    it(`uses size for upload filesize when length is not available`, () => {
      const blob = {
        size: 3333,
        byteLength: 2222
      };

      return spark.board._uploadImageToSparkFiles(conversation, blob)
        .then(() => {
          assert.calledWith(spark.upload, sinon.match({
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

    it(`uses byteLenght for upload filesize when length and size are not available`, () => {
      const blob = {
        byteLength: 2222
      };

      return spark.board._uploadImageToSparkFiles(conversation, blob)
        .then(() => {
          assert.calledWith(spark.upload, sinon.match({
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

  describe(`#children`, () => {

    it(`has a child of realtime`, () => {
      assert.isDefined(spark.board.realtime);
    });
  });

  describe(`#encryptContents`, () => {

    before(() => {
      sinon.stub(spark.board, `encryptSingleContent`).returns(Promise.resolve({
        encryptedData,
        encryptionKeyUrl: fakeURL
      }));
    });

    afterEach(() => {
      spark.board.encryptSingleContent.reset();
    });

    it(`calls encryptSingleContent when type is not image`, () => {

      const curveContents = [{
        type: `curve`
      }];

      return spark.board.encryptContents(fakeURL, curveContents)
        .then(() => {
          assert.calledWith(spark.board.encryptSingleContent, fakeURL, curveContents[0]);
          assert.notCalled(spark.encryption.encryptScr);
        });
    });

    it(`calls encryptText and encryptScr when scr is found in content`, () => {

      const imageContents = [{
        displayName: `FileName`,
        scr: {
          loc: fakeURL
        }
      }];

      return spark.board.encryptContents(fakeURL, imageContents)
        .then(() => {
          assert.calledWith(spark.encryption.encryptScr, fakeURL, {loc: fakeURL});
          assert.calledWith(spark.encryption.encryptText, fakeURL, `FileName`);
        });
    });

    it(`sets the device to config deviceType`, () => {
      const curveContents = [{
        type: `curve`
      }];

      return spark.board.encryptContents(fakeURL, curveContents)
        .then((res) => {
          assert.equal(res[0].device, `FAKE_DEVICE`);
        });
    });
  });

  describe(`#decryptContents`, () => {

    before(() => {
      sinon.stub(spark.board, `decryptSingleContent`, sinon.stub().returns(Promise.resolve({})));
    });

    after(() => {
      spark.board.decryptSingleContent.restore();
    });

    afterEach(() => {
      spark.board.decryptSingleContent.reset();
      spark.encryption.decryptScr.reset();
    });

    it(`calls decryptSingleContent when type is not image`, () => {

      const curveContents = {
        items: [{
          type: `STRING`,
          payload: encryptedData,
          encryptionKeyUrl: fakeURL
        }]
      };

      return spark.board.decryptContents(curveContents)
        .then(() => {
          assert.calledWith(spark.board.decryptSingleContent, fakeURL, encryptedData);
          assert.notCalled(spark.encryption.decryptScr);
          assert.notCalled(spark.encryption.decryptText);
        });
    });

    it(`calls decryptSingleContent when type is FILE`, () => {

      const imageContents = {
        items: [{
          type: `FILE`,
          payload: JSON.stringify({
            type: `image`,
            scr: `encryptedScr`,
            displayName: `encryptedDisplayName`
          }),
          encryptionKeyUrl: fakeURL
        }]
      };

      return spark.board.decryptContents(imageContents)
        .then(() => {
          assert.calledWith(spark.encryption.decryptText, fakeURL, `encryptedDisplayName`);
          assert.calledWith(spark.encryption.decryptScr, fakeURL, `encryptedScr`);
        });
    });
  });

  describe(`#getChannel()`, () => {

    before(() => {
      spark.request.reset();
      return spark.board.getChannel(channel);
    });

    it(`requests GET to channels service`, () => {
      assert.calledWith(spark.request, sinon.match({
        method: `GET`,
        uri: `${boardServiceUrl}/channels/${boardId}`
      }));
    });

  });


  describe(`#getContents()`, () => {

    beforeEach(() => {
      sinon.stub(spark.board, `decryptContents`).returns([`foo`]);
      spark.request.reset();
    });

    afterEach(() => {
      spark.board.decryptContents.restore();
    });

    it(`requests GET contents with default page size`, () => spark.board.getContents(channel)
      .then(() => assert.calledWith(spark.request, {
        uri: `${boardServiceUrl}/channels/${boardId}/contents`,
        qs: {
          contentsLimit: boardConfig.board.numberContentsPerPageForGet
        }
      })));

    it(`requests GET contents with client defined page size`, () => spark.board.getContents(channel, {contentsLimit: 25})
      .then(() => assert.calledWith(spark.request, {
        uri: `${boardServiceUrl}/channels/${boardId}/contents`,
        qs: {
          contentsLimit: 25
        }
      })));
  });

  describe(`#register()`, () => {

    before(() => {
      spark.request.reset();
      return spark.board.register({data: `data`});
    });

    it(`requests POST data to registration service`, () => {
      assert.calledWith(spark.request, sinon.match({
        method: `POST`,
        api: `board`,
        resource: `/registrations`
      }));
    });
  });
});
