/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';
import Board, {config as boardConfig} from '@webex/internal-plugin-board';

describe('plugin-board', () => {
  let webex;
  const encryptedData = 'encryptedData';
  const decryptedText = 'decryptedText';
  const fakeURL = `${process.env.ENCRYPTION_SERVICE_URL || 'https://encryption-a.wbx2.com'}/encryption/api/v1/keys/8a7d3d78-ce75-48aa-a943-2e8acf63fbc9`;

  before(() => {
    webex = new MockWebex({
      children: {
        board: Board
      }
    });

    Object.assign(webex.internal, {
      device: {
        deviceType: 'FAKE_DEVICE'
      },
      encryption: {
        decryptText: sinon.stub().returns(Promise.resolve(decryptedText)),
        encryptText: sinon.stub().returns(Promise.resolve(encryptedData)),
        encryptBinary: sinon.stub().returns(Promise.resolve({
          scr: {},
          cdata: encryptedData
        })),
        decryptScr: sinon.stub().returns(Promise.resolve('decryptedFoo')),
        encryptScr: sinon.stub().returns(Promise.resolve('encryptedFoo'))
      }
    });

    webex.config.board = boardConfig.board;
  });

  describe('encryption', () => {
    describe('#decryptContents', () => {
      before(() => {
        sinon.stub(webex.internal.board, 'decryptSingleContent').callsFake(sinon.stub().returns(Promise.resolve({})));
        sinon.spy(webex.internal.board, 'decryptSingleFileContent');
      });

      after(() => {
        webex.internal.board.decryptSingleContent.restore();
        webex.internal.board.decryptSingleFileContent.restore();
      });

      afterEach(() => {
        webex.internal.board.decryptSingleFileContent.resetHistory();
        webex.internal.board.decryptSingleContent.resetHistory();
        webex.internal.encryption.decryptScr.resetHistory();
        webex.internal.encryption.decryptText.resetHistory();
      });

      it('calls decryptSingleContent when type is not image', () => {
        const curveContents = {
          items: [{
            type: 'STRING',
            payload: encryptedData,
            encryptionKeyUrl: fakeURL
          }]
        };

        return webex.internal.board.decryptContents(curveContents)
          .then(() => {
            assert.calledWith(webex.internal.board.decryptSingleContent, fakeURL, encryptedData);
            assert.notCalled(webex.internal.encryption.decryptScr);
            assert.notCalled(webex.internal.encryption.decryptText);
          });
      });

      it('calls decryptSingleFileContent when type is FILE', () => {
        const imageContents = {
          items: [{
            type: 'FILE',
            payload: JSON.stringify({
              type: 'image',
              displayName: 'encryptedDisplayName'
            }),
            file: {
              scr: 'encryptedScr'
            },
            encryptionKeyUrl: fakeURL
          }]
        };

        return webex.internal.board.decryptContents(imageContents)
          .then(() => {
            assert.calledOnce(webex.internal.board.decryptSingleFileContent);
            assert.calledWith(webex.internal.encryption.decryptText, fakeURL, JSON.stringify({type: 'image', displayName: 'encryptedDisplayName'}));
            assert.calledWith(webex.internal.encryption.decryptScr, fakeURL, 'encryptedScr');
          });
      });

      it('does not require payload when type is FILE', () => {
        const imageContents = {
          items: [{
            type: 'FILE',
            file: {
              scr: 'encryptedScr'
            },
            encryptionKeyUrl: fakeURL
          }]
        };

        return webex.internal.board.decryptContents(imageContents)
          .then(() => {
            assert.calledOnce(webex.internal.board.decryptSingleFileContent);
            assert.notCalled(webex.internal.encryption.decryptText);
            assert.calledWith(webex.internal.encryption.decryptScr, fakeURL, 'encryptedScr');
          });
      });

      it('decrypts FILE metadata displayName', () => {
        const imageContentsWithMetadata = {
          items: [{
            type: 'FILE',
            payload: JSON.stringify({
              type: 'image',
              displayName: 'encryptedDisplayName'
            }),
            file: {
              scr: 'encryptedScr'
            },
            encryptionKeyUrl: fakeURL
          }]
        };

        webex.internal.encryption.decryptText.onFirstCall().returns(JSON.stringify({displayName: 'decryptedDisplayName'}));

        return webex.internal.board.decryptContents(imageContentsWithMetadata)
          .then((contents) => {
            assert.calledOnce(webex.internal.board.decryptSingleFileContent);
            assert.calledWith(webex.internal.encryption.decryptScr, fakeURL, 'encryptedScr');
            assert.calledWith(webex.internal.encryption.decryptText, fakeURL, JSON.stringify({type: 'image', displayName: 'encryptedDisplayName'}));
            assert.equal(contents[0].metadata.displayName, 'decryptedDisplayName');
          });
      });

      it('assigns FILE payload metadata to decrypted file', () => {
        const imageContentsWithMetadata = {
          items: [{
            type: 'FILE',
            payload: JSON.stringify({
              type: 'image',
              size: 123
            }),
            file: {
              scr: 'encryptedScr'
            },
            encryptionKeyUrl: fakeURL
          }]
        };

        webex.internal.encryption.decryptText.onFirstCall().returns(JSON.stringify({type: 'image', size: 123}));

        return webex.internal.board.decryptContents(imageContentsWithMetadata)
          .then((contents) => {
            assert.calledOnce(webex.internal.board.decryptSingleFileContent);
            assert.deepEqual(contents[0].metadata, {
              type: 'image',
              size: 123
            });
          });
      });
    });

    describe('#encryptContents', () => {
      before(() => {
        sinon.stub(webex.internal.board, 'encryptSingleContent').returns(Promise.resolve({
          encryptedData,
          encryptionKeyUrl: fakeURL
        }));
      });

      afterEach(() => {
        webex.internal.board.encryptSingleContent.resetHistory();
      });

      it('calls encryptSingleContent when type is not image', () => {
        const curveContents = [{
          type: 'curve'
        }];

        return webex.internal.board.encryptContents(fakeURL, curveContents)
          .then(() => {
            assert.calledWith(webex.internal.board.encryptSingleContent, fakeURL, curveContents[0]);
            assert.notCalled(webex.internal.encryption.encryptScr);
          });
      });

      it('calls encryptText and encryptScr when scr is found in content', () => {
        const imageContents = [{
          displayName: 'FileName',
          file: {
            scr: {
              loc: fakeURL
            }
          }
        }];

        return webex.internal.board.encryptContents(fakeURL, imageContents)
          .then(() => {
            assert.calledWith(webex.internal.encryption.encryptScr, fakeURL, {loc: fakeURL});
            assert.calledWith(webex.internal.encryption.encryptText, fakeURL, JSON.stringify({displayName: 'FileName'}));
          });
      });

      it('sets the device to config deviceType', () => {
        const curveContents = [{
          type: 'curve'
        }];

        return webex.internal.board.encryptContents(fakeURL, curveContents)
          .then((res) => {
            assert.equal(res[0].device, 'FAKE_DEVICE');
          });
      });
    });
  });
});
