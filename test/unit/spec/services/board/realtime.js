/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var chai = require('chai');
var Board = require('../../../../../src/client/services/board');
var MockSpark = require('../../../lib/mock-spark');
var MockSocket = require('../../../lib/mock-socket');
var Socket = require('../../../../../src/client/mercury/socket');
var delay = require('../../../../lib/delay');
var sinon = require('sinon');
var uuid = require('uuid');
var assert = chai.assert;

sinon.assert.expose(chai.assert, {prefix: ''});

describe('Services', function() {
  describe('Board', function() {
    describe('Realtime', function() {
      var encryptedData = 'encryptedData';
      var boundObject = ['bindings'];
      var fakeURL = 'fakeURL';
      var spark;
      var socketOpenStub;

      before(function() {
        spark = new MockSpark({
          children: {
            board: Board
          },
          encryption: {
            encryptText: sinon.stub().returns(Promise.resolve(encryptedData))
          }
        });
        spark.board.realtime.boardBindings = ['bindings'];
        spark.board.realtime.socket = new MockSocket();

        socketOpenStub = sinon.stub(Socket, 'open');
        socketOpenStub.returns(Promise.resolve(spark.board.realtime.socket));

        sinon.spy(spark.board.realtime.metrics, 'submitConnectionFailureMetric');

      });

      after(function() {
        Socket.open.restore();
      });

      describe('#publish()', function testSetBoardWebSocketUrl() {
        var message = {
          payload: {
            data: 'fake'
          },
          envelope: {
          }
        };
        var conv = {
          defaultActivityEncryptionKeyUrl: fakeURL
        };

        var rcpnts = [{alertType:'none', headers: {}, route: boundObject[0]}];

        before(function() {
          sinon.stub(uuid, 'v4').returns('stubbedUUIDv4');
          return spark.board.realtime.publish(conv, message);
        });

        after(function() {
          uuid.v4.restore();
          spark.encryption.encryptText.reset();
        });

        it('encrypts messsage', function() {
          assert.calledOnce(spark.encryption.encryptText);
        });

        it('sends encrypted data on the socket', function() {
          assert.calledWith(spark.board.realtime.socket.send, sinon.match({
            id: uuid.v4(),
            type: 'publishRequest',
            recipients: rcpnts,
            data: {
              eventType: 'board.activity',
              envelope: {
                encryptionKeyUrl: 'fakeURL'
              },
              payload: 'encryptedData'
            }
          }));
        });
      });

      describe('#publishEncrypted()', function testSetBoardWebSocketUrl() {

        before(function() {
          spark.board.realtime.boardBindings = ['binding'];
          sinon.stub(uuid, 'v4').returns('stubbedUUIDv4');
          return spark.board.realtime.publishEncrypted('fakeURL', 'encryptedData');
        });

        after(function() {
          spark.board.realtime.boardBindings = [];
          uuid.v4.restore();
          spark.encryption.encryptText.reset();
        });

        it('does not encrypt', function() {
          assert.notCalled(spark.encryption.encryptText);
        });

        it('sends encrypted data on the socket', function() {
          assert.calledWith(spark.board.realtime.socket.send, sinon.match({
            id: uuid.v4(),
            type: 'publishRequest',
            recipients: [{
              alertType:'none',
              headers: {},
              route: 'binding'
            }],
            data: {
              eventType: 'board.activity',
              envelope: {
                encryptionKeyUrl: 'fakeURL'
              },
              payload: 'encryptedData'
            }
          }));
        });
      });

      describe('#_attemptConnection()', function() {
        beforeEach(function() {
          socketOpenStub.reset();
        });

        it('opens socket', function() {
          return spark.board.realtime._attemptConnection()
            .then(function() {
              assert.called(socketOpenStub);
            });
        });
      });

      describe('on errors', function() {
        beforeEach(function() {
          socketOpenStub.reset();
        });

        afterEach(function() {
          socketOpenStub.returns(Promise.resolve(spark.board.realtime.socket));
        });

        it('submits connection error to metric', function() {
          spark.board.config.maxRetries = 1;
          socketOpenStub.returns(Promise.reject(new Socket.ConnectionError()));
          return assert.isRejected(spark.board.realtime.connect())
            .then(function() {
              assert.called(spark.board.realtime.metrics.submitConnectionFailureMetric);
            });
        });

        it('rejects on AuthorizationError', function() {
          socketOpenStub.returns(Promise.reject(new Socket.AuthorizationError()));
          return assert.isRejected(spark.board.realtime.connect());
        });
      });

      describe('#_onmessage', function() {
        var fakeEvent;
        beforeEach(function() {
          fakeEvent = {
            id: uuid.v4(),
            data: {
              eventType: 'board.activity',
              actor: {
                id: 'actorId'
              },
              conversationId: uuid.v4()
            },
            timestamp: Date.now(),
            trackingId: 'suffix_' + uuid.v4() + '_' + Date.now()
          };
        });

        it('emits message', function() {
          var spy = sinon.spy();
          spark.board.realtime.on('board.activity', spy);
          return spark.board.realtime.connect()
            .then(function() {
              spark.board.realtime.socket.emit('message', {data: fakeEvent});
              return delay(0);
            })
            .then(function() {
              assert.called(spy);
            });
        });

        it('emits request message if found request id', function() {
          var spy = sinon.spy();
          var spy2 = sinon.spy();
          fakeEvent.data.eventType = 'request';
          fakeEvent.data.requestId = 'requestId';
          spark.board.realtime.on('request', spy);
          spark.board.realtime.on('request:requestId', spy2);
          return spark.board.realtime.connect()
            .then(function() {
              spark.board.realtime.socket.emit('message', {data: fakeEvent});
              return delay(0);
            })
            .then(function() {
              assert.called(spy);
              assert.called(spy2);
            });
        });

        it('does not emits when handler not found', function() {
          fakeEvent.data.eventType = 'unhandler';
          var spy = sinon.spy();
          spark.board.realtime.on('board.activity', spy);
          return spark.board.realtime._onmessage({data: fakeEvent})
            .then(function() {
              assert.notCalled(spy);
            });
        });
      });
    });
  });
});
