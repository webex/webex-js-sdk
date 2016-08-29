/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var assert = require('chai').assert;
var delay = require('../../../../lib/delay');
var Mercury = require('../../../../../src/client/mercury/mercury');
var MockSpark = require('../../../lib/mock-spark');
var MockSocket = require('../../../lib/mock-socket');
var retry = require('../../../../integration/lib/retry');
var Socket = require('../../../../../src/client/mercury/socket');
var sinon = require('sinon');
var uuid = require('uuid');

describe('Client', function() {
  describe('Mercury', function() {
    var mercury;
    var socket;
    var socketOpenStub;
    var spark;

    var asyncMessage;
    var fakeTestMessage;
    var statusStartTypingMessage;

    beforeEach(function() {
      spark = new MockSpark({
        children: {
          mercury: Mercury
        }
      });

      spark.logger = console;

      socket = new MockSocket();
      socketOpenStub = socket.open;
      socketOpenStub.returns(Promise.resolve());

      mercury = spark.mercury;

      sinon.stub(mercury, '_getNewSocket').returns(socket);
      sinon.spy(mercury.metrics, 'submitConnectMetric');
      sinon.spy(mercury.metrics, 'submitConnectionFailureMetric');
      sinon.spy(mercury.metrics, 'submitDisconnectMetric');
      sinon.spy(mercury.metrics, 'submitForceClosureMetric');
      sinon.spy(mercury.metrics, 'submitSkipSequenceMetric');
      sinon.spy(mercury.metrics, 'submitUnexpectedClosureMetric');

      asyncMessage = {
        id: uuid.v4(),
        data: {
          requestId: Date.now(),
          eventType: 'encryption.client_encrypt_keys',
          keys: '[]'
        },
        timestamp: Date.now(),
        trackingId: 'suffix_' + uuid.v4() + '_' + Date.now()
      };

      fakeTestMessage = {
        id: uuid.v4(),
        data: {
          eventType: 'fake.test'
        },
        timestamp: Date.now(),
        trackingId: 'suffix_' + uuid.v4() + '_' + Date.now()
      };

      statusStartTypingMessage = {
        id: uuid.v4(),
        data: {
          eventType: 'status.start_typing',
          actor: {
            id: 'actorId'
          },
          conversationId: uuid.v4()
        },
        timestamp: Date.now(),
        trackingId: 'suffix_' + uuid.v4() + '_' + Date.now()
      };
    });

    describe('#listen()', function() {
      it('proxies to connect', function() {
        sinon.stub(mercury, 'connect');
        mercury.listen();
        assert.called(mercury.connect);
      });
    });

    describe('#stopListening()', function() {
      it('proxies to disconnect', function() {
        sinon.stub(mercury, 'disconnect');
        mercury.stopListening();
        assert.called(mercury.disconnect);
      });
    });

    describe('#connect()', function() {
      it('connects to mercury after a short, random delay', function() {
        var promise = mercury.connect();
        assert.isFalse(mercury.connected, 'Mercury is not connected');
        assert.isTrue(mercury.connecting, 'Mercury is connecting');
        return assert.isFulfilled(promise)
          .then(function() {
            assert.isTrue(mercury.connected, 'Mercury is connected');
            assert.isFalse(mercury.connecting, 'Mercury is not connecting');
          });
      });

      it('emits the `online` event', function() {
        var spy = sinon.spy();
        mercury.on('online', spy);
        return mercury.connect()
          .then(function() {
            assert.called(spy);
          });
      });

      it('emits a metric', function() {
        return mercury.connect()
          .then(function() {
            assert.calledOnce(mercury.metrics.submitConnectMetric);
          });
      });

      it('does not open multiple sockets', function() {
        return Promise.all([
          mercury.connect(),
          mercury.connect(),
          mercury.connect(),
          mercury.connect()
        ])
          .then(function() {
            assert.calledOnce(socket.open);
          });
      });

      describe('when `maxRetries` is set', function() {
        it('fails after `maxRetries` attempts', function() {
          this.timeout(10000);
          mercury.config.maxRetries = 2;
          socketOpenStub.returns(Promise.reject(new Socket.ConnectionError()));
          assert.notCalled(socket.open);
          return assert.isRejected(mercury.connect())
            .then(function() {
              assert.callCount(socket.open, 3);
            });
        });
      });

      describe('when the connection fails', function() {
        this.timeout(20000);

        it('backs off exponentially', function() {
          socketOpenStub.returns(Promise.reject(new Socket.ConnectionError()));
          // Note: onCall is zero-based
          socketOpenStub.onCall(2).returns(Promise.resolve(new MockSocket()));
          assert.notCalled(socket.open);

          var promise = mercury.connect();
          return delay(1000)
            .then(function() {
              assert.calledOnce(socket.open);
              return delay(2000);
            })
            .then(function() {
              assert.calledTwice(socket.open);
              return assert.isFulfilled(promise);
            })
            .then(function() {
              assert.calledThrice(socket.open);
            });
        });

        describe('with Socket.AuthorizationError', function() {
          it('refreshes the access token, reregisters the device, and reconnects to Mercury', function() {
            socketOpenStub.returns(Promise.reject(new Socket.AuthorizationError()));
            socketOpenStub.onCall(2).returns(Promise.resolve(new MockSocket()));
            return mercury.connect()
              .then(function() {
                assert.called(spark.refresh);
              });
          });
        });
      });

      describe('when connected', function() {
        it('resolves immediately', function() {
          return mercury.connect()
            .then(function() {
              assert.isTrue(mercury.connected, 'Mercury is connected');
              assert.isFalse(mercury.connecting, 'Mercury is not connecting');
              var promise = mercury.connect();
              assert.isTrue(mercury.connected, 'Mercury is connected');
              assert.isFalse(mercury.connecting, 'Mercury is not connecting');
              return assert.isFulfilled(promise);
            });
        });

        it('stops trying to connect', function() {
          mercury.connect();
          this.timeout(5000);
          return delay(4000)
            .then(function() {
              assert.calledOnce(socket.open);
            });
        });
      });
    });

    describe('#disconnect()', function() {
      it('disconnects from mercury', function() {
        return mercury.connect()
          .then(function() {
            assert.isTrue(mercury.connected, 'Mercury is connected');
            assert.isFalse(mercury.connecting, 'Mercury is not connecting');
            var promise = mercury.disconnect();
            socket.emit('close', {
              code: 1000,
              reason: 'Done'
            });
            return promise;
          })
          .then(function() {
            assert.isFalse(mercury.connected, 'Mercury is not connected');
            assert.isFalse(mercury.connecting, 'Mercury is not connecting');
            assert.isUndefined(mercury.socket, 'Mercury does not have a socket');
          });
      });

      it('emits a metric', function() {
        return mercury.connect()
          .then(function() {
            socket.emit('close', {
              code: 1000,
              reason: 'Done'
            });

            assert.called(mercury.metrics.submitDisconnectMetric);
          });
      });

      it('stops listening to message events', function() {
        var spy = sinon.spy();
        mercury.on('status.start_typing', spy);

        return mercury.connect()
          .then(function() {
            assert.isTrue(mercury.connected, 'Mercury is connected');
            assert.isFalse(mercury.connecting, 'Mercury is not connecting');

            socket.emit('message', {data: statusStartTypingMessage});

            var promise = mercury.disconnect();

            socket.emit('message', {data: statusStartTypingMessage});
            socket.emit('close', {
              code: 1000,
              reason: 'Done'
            });
            socket.emit('message', {data: statusStartTypingMessage});

            return promise;
          })
          .then(function() {
            socket.emit('message', {data: statusStartTypingMessage});
            assert.calledOnce(spy);
          });
      });

      describe('when there is a connection attempt inflight', function() {
        it('stops the attempt', function() {
          this.timeout(10000);
          socketOpenStub.returns(Promise.reject(new Socket.ConnectionError()));
          var promise = mercury.connect();
          return delay(1000)
            .then(function() {
              mercury.disconnect();
              return assert.isRejected(promise);
            });
        });
      });
    });

    describe('#_reconnect()', function() {
      it('reconnects to mercury after a short, random delay', function() {
        mercury.connected = false;
        mercury.connecting = false;
        var promise = mercury._reconnect();
        assert.isFalse(mercury.connected, 'Mercury is not connected');
        assert.isTrue(mercury.connecting, 'Mercury is connecting');

        return assert.isFulfilled(promise)
          .then(function() {
            assert.isTrue(mercury.connected, 'Mercury is connected');
            assert.isFalse(mercury.connecting, 'Mercury is not connecting');
          });
      });

      it('emits a metric', function() {
        return mercury._reconnect()
          .then(function() {
            assert.called(mercury.metrics.submitConnectMetric);
          });
      });

      it('does not open multiple sockets', function() {
        return Promise.all([
          mercury._reconnect(),
          mercury._reconnect(),
          mercury._reconnect(),
          mercury._reconnect()
        ])
          .then(function() {
            assert.calledOnce(socket.open);
          });
      });

      describe('when the connection fails', function() {
        it('backs off exponentially', function() {
          this.timeout(10000);
          socketOpenStub.returns(Promise.reject(new Socket.ConnectionError()));
          // Note: onCall is zero-based
          socketOpenStub.onCall(2).returns(Promise.resolve(new MockSocket()));
          assert.notCalled(socket.open);

          var promise = mercury._reconnect();
          return delay(1000)
            .then(function() {
              assert.calledOnce(socket.open);
              return delay(2000);
            })
            .then(function() {
              assert.calledTwice(socket.open);
              return assert.isFulfilled(promise);
            })
            .then(function() {
              assert.calledThrice(socket.open);
            });
        });

        describe('with Socket.AuthorizationError', function() {
          it('refreshes the access token, reregisters the device, and reconnects to Mercury', function() {
            this.timeout(10000);
            socketOpenStub.returns(Promise.reject(new Socket.AuthorizationError()));
            socketOpenStub.onCall(2).returns(Promise.resolve(new MockSocket()));
            return mercury._reconnect()
              .then(function() {
                assert.called(spark.refresh);
              });
          });
        });
      });

      describe('when connected', function() {
        it('resolves immediately', function() {
          return mercury._reconnect()
            .then(function() {
              assert.isTrue(mercury.connected, 'Mercury is connected');
              assert.isFalse(mercury.connecting, 'Mercury is not connecting');
              var promise = mercury._reconnect();
              assert.isTrue(mercury.connected, 'Mercury is connected');
              assert.isFalse(mercury.connecting, 'Mercury is not connecting');
              return assert.isFulfilled(promise);
            });
        });
      });
    });

    describe('#_emit()', function() {
      describe('when an event handler fails', function() {
        it('does not break handling of subsequent events', function() {
          mercury.on('break', function() {
            throw new Error();
          });

          return mercury._emit('break');
        });
      });
    });

    describe('when a close event is received', function() {
      [
        {
          code: 1000,
          reason: 'idle',
          action: 'reconnect'
        },
        {
          code: 1000,
          reason: 'done (forced)',
          action: 'reconnect'
        },
        {
          code: 1000,
          reason: 'pong not received',
          action: 'reconnect'
        },
        {
          code: 1000,
          reason: 'pong mismatch',
          action: 'reconnect'
        },
        {
          code: 1000,
          action: 'close'
        },
        {
          code: 1003,
          action: 'close'
        },
        {
          code: 1001,
          action: 'reconnect'
        },
        {
          code: 1005,
          action: 'reconnect'
        },
        {
          code: 1006,
          action: 'reconnect'
        },
        {
          code: 1011,
          action: 'reconnect'
        },
        {
          code: 4000,
          action: 'replace'
        },
        {
          action: 'close'
        }
      ].forEach(function(def) {
        var action = def.action;
        var code = def.code;
        var reason = def.reason;

        var str = 'when an event';
        if (code && reason) {
          str += ' with code `' + code + '` and reason `' + reason + '`';
        }
        else if (code) {
          str += ' with code `' + code + '`';
        }
        else if (reason) {
          str += ' with reason `' + code + '`';
        }
        str += ' is received';
        describe(str, function() {
          it('takes the `' + action + '` action', function() {
            return retry(function() {
              if (mercury._reconnect.restore) {
                mercury._reconnect.restore();
              }

              var offlineSpy = sinon.spy();
              mercury.on('offline', offlineSpy);
              sinon.spy(mercury, '_reconnect');

              var eventSpy = sinon.spy();
              switch (action) {
                case 'close':
                  mercury.on('offline:permanent', eventSpy);
                  break;

                case 'reconnect':
                  mercury.on('offline:transient', eventSpy);
                  break;

                case 'replace':
                  mercury.on('offline:replaced', eventSpy);
              }

              return mercury.connect()
                .then(function() {
                  socket.emit('close', {
                    code: code,
                    reason: reason
                  });
                  return delay(0);
                })
                .then(function() {
                  assert.called(offlineSpy);
                  assert.calledWith(offlineSpy, {
                    code: code,
                    reason: reason
                  });
                  assert.called(eventSpy);
                  assert.isFalse(mercury.connected, 'Mercury is not connected');
                  if (action === 'reconnect') {
                    assert.called(mercury._reconnect);
                    assert.isTrue(mercury.connecting, 'Mercury is connecting');
                    // Block until reconnect completes so logs don't overlap
                    return mercury._reconnect();
                  }
                });
            });
          });
        });
      });
    });

    describe('when a message event is received', function() {
      it('emits the parsed Mercury event', function() {
        var startSpy = sinon.spy();
        var stopSpy = sinon.spy();

        mercury.on('status.start_typing', startSpy);
        mercury.on('status.stop_typing', stopSpy);

        return mercury.connect()
          .then(function() {
            socket.emit('message', {data: statusStartTypingMessage});
            return delay(0);
          })
          .then(function() {
            assert.callCount(startSpy, 1);
            assert.callCount(stopSpy, 0);
            assert.calledWith(startSpy, statusStartTypingMessage.data, statusStartTypingMessage);
          });
      });

      it('calls any autowired handlers for the event', function() {
        spark.fake = {
          processTestEvent: sinon.spy()
        };

        return mercury.connect()
          .then(function() {
            socket.emit('message', {data: fakeTestMessage});
            return delay(0);
          })
          .then(function() {
            assert.called(spark.fake.processTestEvent);
          });
      });

      // TODO remove once encryption v1 goes away
      it('emits async responses', function() {
        var asyncSpy = sinon.spy();
        var requestSpy = sinon.spy();
        var request1Spy = sinon.spy();

        mercury.on('encryption.client_encrypt_keys', asyncSpy);
        mercury.on('request', requestSpy);
        mercury.on('request:' + asyncMessage.data.requestId, request1Spy);

        return mercury.connect()
          .then(function() {
            socket.emit('message', {data: asyncMessage});

            return delay(0);
          })
          .then(function() {
            assert.callCount(asyncSpy, 0);
            assert.callCount(requestSpy, 1);
            assert.callCount(request1Spy, 1);

            assert.calledWith(requestSpy, asyncMessage.data);
            assert.calledWith(request1Spy, asyncMessage.data);
          });
      });
    });

    describe('when buffer state event is received', function() {
      it('emits the event even before connect promise is resolved', function() {
        var bufferStateMessage = {
          data: {
            eventType: 'mercury.buffer_state'
          }
        };
        var bufferSpy = sinon.spy();
        var onlineSpy = sinon.spy();

        // Buffer state message is emitted after authorization
        spark.credentials.getAuthorization = function() {
          return new Promise(function(resolve) {
            resolve('Token');
          })
            .then(function() {
              assert.notCalled(onlineSpy);
              socket.emit('message', {data: bufferStateMessage});
            });
        };

        mercury.on('mercury.buffer_state', bufferSpy);
        mercury.on('online', onlineSpy);

        mercury.connect();

        return assert.isFulfilled(mercury.connect())
          .then(function() {
            assert.callCount(bufferSpy, 1);
            assert.calledWith(bufferSpy, bufferStateMessage.data);
          });
      });
    });

    describe('when a sequence number is skipped', function() {
      it('emits a metric', function() {
        return mercury.connect()
          .then(function() {
            socket.emit('sequence-mismatch', 1, 3);
            assert.called(mercury.metrics.submitSkipSequenceMetric);
          });
      });
    });

    describe('#_moveHeadersToData', function() {
      it('Moves one header information to activity', function() {
        var lastSeenActivityDate = 'Some date';
        var data = {
          activity: {}
        };
        var envelope = {
          headers: {
            'data.activity.target.lastSeenActivityDate': lastSeenActivityDate
          },
          data: data
        };
        mercury._moveHeadersToData(envelope);

        assert.equal(data.activity.target.lastSeenActivityDate, lastSeenActivityDate);
      });

      it('Move multiple header information to activity', function() {
        var lastSeenActivityDate = 'Some date';
        var lastReadableActivityDate = 'Another date';
        var data = {
          activity: {}
        };
        var envelope = {
          headers: {
            'data.activity.target.lastSeenActivityDate': lastSeenActivityDate,
            'data.activity.target.lastReadableActivityDate': lastReadableActivityDate
          },
          data: data
        };
        mercury._moveHeadersToData(envelope);

        assert.equal(data.activity.target.lastSeenActivityDate, lastSeenActivityDate);
        assert.equal(data.activity.target.lastReadableActivityDate, lastReadableActivityDate);
      });

      it('call _moveHeadersToData through _onmessage', function() {
        var lastSeenActivityDate = '7830941987';
        var lastReadableActivityDate = '2929473478';
        var data = {
          activity: {}
        };
        var envelope = {
          data: {
            headers: {
              'data.activity.target.lastSeenActivityDate': lastSeenActivityDate,
              'data.activity.target.lastReadableActivityDate': lastReadableActivityDate
            },
            data: data
          }
        };
        var _getEventHandlersStub = sinon.stub(mercury, '_getEventHandlers');
        _getEventHandlersStub.returns([]);
        mercury._onmessage(envelope);
        _getEventHandlersStub.restore();

        assert.equal(data.activity.target.lastSeenActivityDate, lastSeenActivityDate);
        assert.equal(data.activity.target.lastReadableActivityDate, lastReadableActivityDate);
      });
    });

  });
});
