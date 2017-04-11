/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

if (typeof Promise === 'undefined') {
  require('es6-promise').polyfill();
}

var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
var Board = require('../../../../../src/client/services/board');
var MockSpark = require('../../../lib/mock-spark');
var sinon = require('sinon');
var assert = chai.assert;

chai.use(chaiAsPromised);
sinon.assert.expose(chai.assert, {prefix: ''});

describe('Services', function() {
  describe('Board', function() {
    describe('Persistence', function() {
      var boardServiceUrl = 'https://awesome.service.url';
      var spark;
      var encryptedData = 'encryptedData';
      var fakeURL = 'fakeURL';
      var image = {
        height: 900,
        width: 1600,
        size: 1500
      };
      var conversation = {
        id: '7c7e69a0-a086-11e6-8670-d7b4b51d7641',
        defaultActivityEncryptionKeyUrl: fakeURL,
        kmsResourceObjectUrl: 'https://encryption-a.wbx2.com/encryption/api/v1/resources/8693f702-2012-40c6-9ec4-f1392f0a620a',
        aclUrl: 'https://acl-a.wbx2.com/acl/api/v1/acls/7ca94a30-a086-11e6-b599-d90deb9846ed'
      };
      var mockKey = {
        keyUrl: 'https://encryption-a.wbx2.com/encryption/api/v1/keys/7ad503ec-854b-4fce-a7f0-182e1997bdb6',
        keyValue: {
          kty: 'oct',
          kid: 'https://encryption-a.wbx2.com/encryption/api/v1/keys/7ad503ec-854b-4fce-a7f0-182e1997bdb6'
        }
      };

      var boardId = 'boardId';
      var channel = {
        channelId: boardId,
        channelUrl: boardServiceUrl + '/channels/' + boardId,
        aclUrlLink: conversation.aclUrl,
        defaultEncryptionKeyUrl: mockKey.keyUrl,
        kmsMessage: {
          method: 'create',
          uri: '/resources',
          userIds: [conversation.kmsResourceObjectUrl],
          keyUris: []
        }
      };

      var encryptedChannel = {
        channelId: boardId,
        channelUrl: boardServiceUrl + '/channels/' + boardId,
        aclUrlLink: conversation.aclUrl,
        defaultEncryptionKeyUrl: mockKey.keyUrl,
        kmsMessage: '<encrypted>'
      };

      var decryptedChannel = {
        channelId: boardId,
        channelUrl: boardServiceUrl + '/channels/' + boardId,
        creatorId: 'c321e329-28d6-4d52-a9d1-374010411530',
        aclUrlLink: conversation.aclUrl,
        defaultEncryptionKeyUrl: mockKey.keyUrl,
        kmsMessage: {
          status: 201,
          resource: {
            uri: 'https://encryption-a.wbx2.com/encryption/api/v1/resources/2853285c-c46b-4b35-9542-9a81d4e3c87f',
            keyUris: ['https://encryption-a.wbx2.com/encryption/api/v1/keys/5042787d-510b-46f3-b83c-ea73032de851'],
            authorizationUris: [
              'https://encryption-a.wbx2.com/encryption/api/v1/authorizations/aHR0cHM6Ly9lbmNyeXB0aW9uLWEud2J4Mi5jb20vZW5jcnlwdGlvbi9hcGkvdjEvcmVzb3VyY2VzLzI3OWIyMjgyLWZmYTItNGM3ZC04NGRmLTRkNDVlZmUzYTMzNQBodHRwczovL2VuY3J5cHRpb24tYS53YngyLmNvbS9lbmNyeXB0aW9uL2FwaS92MS9yZXNvdXJjZXMvMjg1MzI4NWMtYzQ2Yi00YjM1LTk1NDItOWE4MWQ0ZTNjODdm',
              'https://encryption-a.wbx2.com/encryption/api/v1/authorizations/YzMyMWUzMjktMjhkNi00ZDUyLWE5ZDEtMzc0MDEwNDExNTMwAGh0dHBzOi8vZW5jcnlwdGlvbi1hLndieDIuY29tL2VuY3J5cHRpb24vYXBpL3YxL3Jlc291cmNlcy8yODUzMjg1Yy1jNDZiLTRiMzUtOTU0Mi05YTgxZDRlM2M4N2Y'
            ]
          }
        }
      };

      var localClusterServiceUrls = {
        mercuryApiServiceClusterUrl: 'https:/mercury-api-a.wbx2.com/v2',
        mercuryConnectionServiceClusterUrl: 'https://mercury-connection-a.wbx2.com'
      };

      var webSocketUrl = 'wss://mercury-connection-a.wbx2.com/v1/app/...';

      var data1 = {
        contentUrl: channel.channelUrl + '/contents/data1',
        contentId: 'data1',
        type: 'test',
        data: 'data1'
      };

      var data2 = {
        type: 'test',
        data: 'data2'
      };


      before(function() {
        spark = new MockSpark({
          children: {
            board: Board
          },
          conversation: {
            encrypter: {
              encryptProperty: sinon.stub().returns(Promise.resolve(encryptedChannel))
            },
            decrypter: {
              decryptObject: sinon.stub().returns(Promise.resolve(decryptedChannel))
            }
          },
          encryption: {
            encryptText: sinon.stub().returns(Promise.resolve(encryptedData)),
            encryptBinary: sinon.stub().returns(Promise.resolve({
              cblob: encryptedData
            })),
            download: sinon.stub().returns(Promise.resolve({
              toArrayBuffer: sinon.stub()
            })),
            decryptScr: sinon.stub().returns(Promise.resolve('decryptedFoo')),
            encryptScr: sinon.stub().returns(Promise.resolve('encryptedFoo')),
            getUnusedKey: sinon.stub().returns(Promise.resolve(mockKey)),
            kms: {
              prepareRequest: sinon.stub().returns(Promise.resolve()),
              request: sinon.stub().returns(Promise.resolve())
            }
          },
          device: {
            webSocketUrl: webSocketUrl,
            deviceType: 'FAKE_DEVICE',
            getServiceUrl: function() {
              return boardServiceUrl;
            }
          }
        });
      });

      describe('#register()', function() {

        before(function() {
          spark.request.reset();
          return spark.board.persistence.register({data: 'data'});
        });

        it('requests POST data to board registration service', function() {
          assert.calledWith(spark.request, sinon.match({
            method: 'POST',
            api: 'board',
            resource: '/registrations'
          }));
        });
      });

      describe('#registerToShareMercury()', function() {

        beforeEach(function() {
          spark.request.reset();
          spark.feature.getFeature.returns(true);
          spark.mercury.localClusterServiceUrls = localClusterServiceUrls;
        });

        it('requests POST to board service', function() {
          return spark.board.persistence.registerToShareMercury(channel)
            .then(function() {
              assert.calledWith(spark.request, sinon.match({
                method: 'POST',
                uri: channel.channelUrl + '/register',
                body: {
                  mercuryConnectionServiceClusterUrl: localClusterServiceUrls.mercuryConnectionServiceClusterUrl,
                  webSocketUrl: webSocketUrl,
                  action: 'REPLACE'
                }
              }));
            });
        });

        it('rejects if `web-shared-mercury` feature is not enabled', function() {
          spark.feature.getFeature.returns(false);
          return assert.isRejected(spark.board.persistence.registerToShareMercury(channel));
        });

        it('rejects if localClusterServiceUrls is null', function() {
          spark.mercury.localClusterServiceUrls = null;
          return assert.isRejected(spark.board.persistence.registerToShareMercury(channel));
        });
      });


      describe('#createChannel()', function() {

        before(function() {
          spark.request.reset();
          spark.request.returns(Promise.resolve({statusCode: 200, body: decryptedChannel}));
          spark.encryption.kms.request.reset();
          spark.encryption.kms.prepareRequest.reset();
          return spark.board.persistence.createChannel(conversation);
        });

        after(function() {
          // reset request to its original behavior
          spark.request.returns(Promise.resolve({
            body: {}
          }));
        });

        it('requests POST to channels service', function() {
          assert.calledWith(spark.request, sinon.match({
            method: 'POST',
            api: 'board',
            resource: '/channels',
            body: encryptedChannel
          }));
        });

        it('requests to KMS to remove board creator authorization', function() {
          assert.calledWith(spark.encryption.kms.prepareRequest, sinon.match({
            method: 'delete',
            uri: decryptedChannel.kmsMessage.resource.uri + '/authorizations?authId=' + decryptedChannel.creatorId
          }));
          assert.called(spark.encryption.kms.request);
        });

        it('does not request to KMS to remove board creator if board creator is not authorized', function() {
          var channelRes = {
            channelId: boardId,
            channelUrl: boardServiceUrl + '/channels/' + boardId,
            creatorId: 'c321e329-28d6-4d52-a9d1-374010411530',
            aclUrlLink: conversation.aclUrl,
            defaultEncryptionKeyUrl: mockKey.keyUrl,
            kmsMessage: {
              status: 201,
              resource: {
                uri: 'https://encryption-a.wbx2.com/encryption/api/v1/resources/2853285c-c46b-4b35-9542-9a81d4e3c87f',
                keyUris: ['https://encryption-a.wbx2.com/encryption/api/v1/keys/5042787d-510b-46f3-b83c-ea73032de851'],
                authorizationUris: [
                  'https://encryption-a.wbx2.com/encryption/api/v1/authorizations/aHR0cHM6Ly9lbmNyeXB0aW9uLWEud2J4Mi5jb20vZW5jcnlwdGlvbi9hcGkvdjEvcmVzb3VyY2VzLzI3OWIyMjgyLWZmYTItNGM3ZC04NGRmLTRkNDVlZmUzYTMzNQBodHRwczovL2VuY3J5cHRpb24tYS53YngyLmNvbS9lbmNyeXB0aW9uL2FwaS92MS9yZXNvdXJjZXMvMjg1MzI4NWMtYzQ2Yi00YjM1LTk1NDItOWE4MWQ0ZTNjODdm'
                ]
              }
            }
          };

          spark.conversation.decrypter.decryptObject.returns(Promise.resolve(channelRes));
          spark.encryption.kms.request.reset();
          spark.encryption.kms.prepareRequest.reset();
          return spark.board.persistence.createChannel(conversation)
            .then(function() {
              assert.notCalled(spark.encryption.kms.prepareRequest);
              assert.notCalled(spark.encryption.kms.request);
            });
        });
      });

      describe('#getChannel()', function() {

        before(function() {
          spark.request.reset();
          return spark.board.persistence.getChannel(channel);
        });

        it('requests GET to channels service', function() {
          assert.calledWith(spark.request, sinon.match({
            method: 'GET',
            uri: boardServiceUrl + '/channels/' + boardId
          }));
        });

      });

      describe('#getChannels()', function() {

        before(function() {
          spark.board.persistence.getChannels(conversation);
        });

        it('requires conversation', function() {
          return Promise.all([
            assert.isRejected(spark.board.persistence.getChannels(), '`conversation` is required')
          ]);
        });

        it('requests GET to channels service', function() {
          assert.calledWith(spark.request, sinon.match({
            api: 'board',
            resource: '/channels',
            qs: {
              aclUrlLink: conversation.aclUrl
            }
          }));
        });
      });

      describe('#addContent()', function() {
        this.timeout(60000);

        beforeEach(function() {
          spark.request.reset();
        });

        it('requests POST all contents to contents', function() {
          return spark.board.persistence.addContent(channel, [data1, data2])
            .then(function() {
              assert.calledWith(spark.request, sinon.match({
                method: 'POST',
                uri: boardServiceUrl + '/channels/' + boardId + '/contents',
                body: [{
                  device: 'FAKE_DEVICE',
                  type: 'STRING',
                  encryptionKeyUrl: channel.defaultEncryptionKeyUrl,
                  payload: 'encryptedData'
                }, {
                  device: 'FAKE_DEVICE',
                  type: 'STRING',
                  encryptionKeyUrl: channel.defaultEncryptionKeyUrl,
                  payload: 'encryptedData'
                }]
              }));
            });
        });

        it('sends large data using multiple requests', function() {
          var largeData = [];

          for (var i = 0; i < 400; i++) {
            largeData.push({data: i});
          }

          return spark.board.persistence.addContent(channel, largeData)
            .then(function() {
              assert.equal(spark.request.callCount, 3);
            });
        });

      });

      describe('#setSnapshotImage()', function() {
        before(function() {
          spark.request.reset();
          sinon.stub(spark.board, '_uploadImage').returns(Promise.resolve({
            loc: fakeURL
          }));
          spark.encryption.encryptScr.reset();
        });

        after(function() {
          spark.board._uploadImage.restore();
          spark.encryption.encryptScr.reset();
        });

        it('requests PATCH to board service', function() {
          return spark.board.persistence.setSnapshotImage(channel, image)
            .then(function() {
              assert.calledWith(spark.request, sinon.match({
                method: 'PATCH',
                api: 'board',
                resource: '/channels/' + boardId,
                body: {
                  image: {
                    url: fakeURL,
                    height: image.height,
                    width: image.width,
                    mimeType: 'image/png',
                    scr: 'encryptedFoo',
                    encryptionKeyUrl: channel.defaultEncryptionKeyUrl,
                    fileSize: image.size
                  }
                }
              }));
            });
        });
      });

      describe('#getAllContent()', function() {

        before(function() {
          spark.request.returns(Promise.resolve({headers: {}}));
          sinon.stub(spark.board, 'parseLinkHeaders');
          sinon.stub(spark.board, 'decryptContents').returns(['foo']);
          spark.request.reset();
          return spark.board.persistence.getAllContent(channel);
        });

        after(function() {
          spark.board.decryptContents.restore();
          spark.board.parseLinkHeaders.restore();
          spark.request.reset();
        });

        it('requests GET contents', function() {
          assert.calledWith(spark.request, sinon.match({
            method: 'GET',
            uri: boardServiceUrl + '/channels/' + boardId + '/contents'
          }));
        });
      });

      describe('#deleteAllContent()', function() {

        before(function() {
          spark.request.reset();
          return spark.board.persistence.deleteAllContent(channel);
        });

        it('requests DELETE contents', function() {
          assert.calledWith(spark.request, sinon.match({
            method: 'DELETE',
            uri: boardServiceUrl + '/channels/' + boardId + '/contents'
          }));
        });
      });

      describe('#_getPageOfContents()', function() {
        before(function() {
          spark.request.returns(Promise.resolve({headers: {}}));
          sinon.stub(spark.board, 'parseLinkHeaders');
          sinon.stub(spark.board, 'decryptContents').returns(['foo']);
          spark.request.reset();
          return spark.board.persistence._getPageOfContents(channel);
        });

        after(function() {
          spark.board.decryptContents.restore();
          spark.board.parseLinkHeaders.restore();
          spark.request.reset();
        });

        it('requests GET contents', function() {
          assert.calledWith(spark.request, sinon.match({
            method: 'GET',
            uri: boardServiceUrl + '/channels/' + boardId + '/contents',
            qs: {}
          }));
        });
      });
    });
  });
});
