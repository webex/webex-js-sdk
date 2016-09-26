/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
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
      var conversation = {
        id: 'superUniqueId',
        defaultActivityEncryptionKeyUrl: fakeURL
      };
      var boardId = 'boardId';
      var channel = {
        channelUrl: boardServiceUrl + '/channels/' + boardId
      };
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
          encryption: {
            encryptText: sinon.stub().returns(Promise.resolve(encryptedData)),
            encryptBinary: sinon.stub().returns(Promise.resolve({
              cblob: encryptedData
            })),
            download: sinon.stub().returns(Promise.resolve({
              toArrayBuffer: sinon.stub()
            })),
            decryptScr: sinon.stub().returns(Promise.resolve('decryptedFoo'))
          },
          device: {
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

        it('requests POST data to registration service', function() {
          assert.calledWith(spark.request, sinon.match({
            method: 'POST',
            api: 'board',
            resource: '/registrations'
          }));
        });
      });

      describe('#createChannel()', function() {

        before(function() {
          spark.request.reset();
          return spark.board.persistence.createChannel({aclUrl: 'foo'});
        });

        it('requests POST to channels service', function() {
          assert.calledWith(spark.request, sinon.match({
            method: 'POST',
            api: 'board',
            resource: '/channels',
            body: {
              aclUrl: 'foo'
            }
          }));
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
          spark.board.persistence.getChannels({
            conversationId: 'fakeConversationId'
          });
        });

        it('requires a conversationId as an option', function() {
          return Promise.all([
            assert.isRejected(spark.board.persistence.getChannels(), '`conversationId` is required')
          ]);
        });

        it('requests GET to channels service', function() {
          assert.calledWith(spark.request, sinon.match({
            api: 'board',
            resource: '/channels',
            qs: {
              conversationId: 'fakeConversationId'
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
          return spark.board.persistence.addContent(conversation, channel, [data1, data2])
            .then(function() {
              assert.calledWith(spark.request, sinon.match({
                method: 'POST',
                uri: boardServiceUrl + '/channels/' + boardId + '/contents',
                body: [{
                  device: 'FAKE_DEVICE',
                  type: 'STRING',
                  encryptionKeyUrl: 'fakeURL',
                  payload: 'encryptedData'
                }, {
                  device: 'FAKE_DEVICE',
                  type: 'STRING',
                  encryptionKeyUrl: 'fakeURL',
                  payload: 'encryptedData'
                }]
              }));
            });
        });

        it('sends large data using multiple requests', function() {
          var largeData = [];

          for (var i = 0; i < 2500; i++) {
            largeData.push({data: i});
          }

          return spark.board.persistence.addContent(conversation, channel, largeData)
            .then(function() {
              assert.equal(spark.request.callCount, 3);
            });
        });

      });

      describe('#getAllContent()', function() {

        before(function() {
          sinon.stub(spark.board, 'decryptContents').returns(['foo']);
          spark.request.reset();
          return spark.board.persistence.getAllContent(channel);
        });

        after(function() {
          spark.board.decryptContents.restore();
        });


        it('requests GET contents', function() {
          assert.calledWith(spark.request, sinon.match({
            method: 'GET',
            uri: boardServiceUrl + '/channels/' + boardId + '/contents'
          }));
        });
      });

      describe('#deleteContent()', function() {

        before(function() {
          spark.request.reset();
          return spark.board.persistence.deleteContent(channel, data1);
        });

        it('requests DELETE content', function() {
          assert.calledWith(spark.request, sinon.match({
            method: 'DELETE',
            uri: boardServiceUrl + '/channels/' + boardId + '/contents/' + data1.contentId
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
    });
  });
});
