/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var assert = require('chai').assert;
var delay = require('../../../../lib/delay');
var forEach = require('lodash.foreach');
var MockWebSocket = require('../../../lib/mock-web-socket');
var Socket = require('../../../../../src/client/mercury/socket');
var sinon = require('sinon');

describe('Client', function() {
  describe('Mercury', function() {
    describe('Socket', function() {
      var socket;
      var _socket;

      var mockoptions = {
        forceCloseDelay: 100,
        pingInterval: 100,
        pongTimeout: 90,
        logger: console,
        token: 'mocktoken',
        trackingId: 'mocktrackingid'
      };

      beforeEach(function() {
        sinon.stub(Socket.prototype, '_open', function(url) {
          _socket = new MockWebSocket(url);
          return _socket;
        });

        sinon.spy(Socket.prototype, '_ping');

        socket = new Socket();
        var promise = socket.open('ws://example.com', mockoptions);

        try {
          _socket.readyState = 1;

          _socket.emit('open');

          _socket.emit('message', {
            data: JSON.stringify({
              id: JSON.parse(_socket.send.args[1][0]).id,
              type: 'pong',
              sequenceNumber: 3
            })
          });
        }
        catch (e) {
          // Note: we probably don't care about this error; we just want to
          // return the promise so we know why it rejected.
          console.error(e);
        }


        return promise.then(function() {
          _socket.emit('message', {
            data: JSON.stringify({
              id: JSON.parse(_socket.send.args[3][0]).id,
              type: 'pong',
              sequenceNumber: 4
            })
          });

          _socket.readyState = 1;
        });
      });

      afterEach(function() {
        Socket.prototype._open.restore();
        if (Socket.prototype._ping.restore) {
          Socket.prototype._ping.restore();
        }
        if (socket) {
          socket.close();
        }
        _socket = undefined;
      });


      describe('#binaryType', function() {
        it('proxies to the underlying socket', function() {
          assert.notEqual(socket.binaryType, 'test');
          _socket.binaryType = 'test';
          assert.equal(socket.binaryType, 'test');
        });
      });

      describe('#bufferedAmount', function() {
        it('proxies to the underlying socket', function() {
          assert.notEqual(socket.bufferedAmount, 'test');
          _socket.bufferedAmount = 'test';
          assert.equal(socket.bufferedAmount, 'test');
        });
      });

      describe('#extensions', function() {
        it('proxies to the underlying socket', function() {
          assert.notEqual(socket.extensions, 'test');
          _socket.extensions = 'test';
          assert.equal(socket.extensions, 'test');
        });
      });

      describe('#protocol', function() {
        it('proxies to the underlying socket', function() {
          assert.notEqual(socket.protocol, 'test');
          _socket.protocol = 'test';
          assert.equal(socket.protocol, 'test');
        });
      });

      describe('#readyState', function() {
        it('proxies to the underlying socket', function() {
          assert.notEqual(socket.readyState, 'test');
          _socket.readyState = 'test';
          assert.equal(socket.readyState, 'test');
        });
      });

      describe('#url', function() {
        it('proxies to the underlying socket', function() {
          assert.notEqual(socket.url, 'test');
          _socket.url = 'test';
          assert.equal(socket.url, 'test');
        });
      });

      describe('#open()', function() {
        it('requires a `url` parameter', function() {
          var s = new Socket();
          return assert.isRejected(s.open(), /`url` is required/);
        });

        it('requires a forceCloseDelay option', function() {
          var s = new Socket();
          return assert.isRejected(s.open('ws://example.com'), /`options.forceCloseDelay` is required/);
        });

        it('requires a pingInterval option', function() {
          var s = new Socket();
          return assert.isRejected(s.open('ws://example.com', {
            forceCloseDelay: 100
          }), /`options.pingInterval` is required/);
        });

        it('requires a pongTimeout option', function() {
          var s = new Socket();
          return assert.isRejected(s.open('ws://example.com', {
            forceCloseDelay: 100,
            pingInterval: 100
          }), /`options.pongTimeout` is required/);
        });

        it('requires a token option', function() {
          var s = new Socket();
          return assert.isRejected(s.open('ws://example.com', {
            forceCloseDelay: 100,
            pingInterval: 100,
            pongTimeout: 90
          }), /`options.token` is required/);
        });

        it('requires a trackingI option', function() {
          var s = new Socket();
          return assert.isRejected(s.open('ws://example.com'), {
            forceCloseDelay: 100,
            pingInterval: 100,
            pongTimeout: 90,
            token: 'mocktoken'
          }, /`options.trackingId` is required/);
        });

        it('requires a logger option', function() {
          var s = new Socket();
          return assert.isRejected(s.open('ws://example.com', {
            forceCloseDelay: 100,
            pingInterval: 100,
            pongTimeout: 90,
            token: 'mocktoken',
            trackingId: 'mocktrackingid'
          }), /`options.logger` is required/);
        });

        it('accepts a logLevelToken option', function() {
          var s = new Socket();
          var promise = s.open('ws://example.com', {
            forceCloseDelay: 100,
            pingInterval: 100,
            pongTimeout: 90,
            logger: console,
            token: 'mocktoken',
            trackingId: 'mocktrackingid',
            logLevelToken: 'mocklogleveltoken'
          });

          _socket.readyState = 1;
          _socket.emit('open');

          _socket.emit('message', {
            data: JSON.stringify({
              id: JSON.parse(_socket.send.args[1][0]).id,
              type: 'pong'
            })
          });

          return promise.then(function() {
            assert.equal(s.logLevelToken, 'mocklogleveltoken');
          });
        });

        it('cannot be called more than once', function() {
          assert.isDefined(socket._socket);
          return assert.isRejected(socket.open('ws://example.com'), /socket#open\(\) can only be called once/);
        });

        it('ensures we always use text-mode WebSockets and get buffer states', function() {
          var s = new Socket();
          s.open('ws://example.com', mockoptions);
          assert.match(s.url, /outboundWireFormat=text/);
          assert.equal(s.url, 'ws://example.com?outboundWireFormat=text&bufferStates=true');

          s = new Socket();
          s.open('ws://example.com?queryparam=something', mockoptions);
          assert.match(s.url, /outboundWireFormat=text/);
          assert.equal(s.url, 'ws://example.com?queryparam=something&outboundWireFormat=text&bufferStates=true');
        });

        it('does not duplicate url queries', function() {
          var s = new Socket();
          s.open('ws://example.com?outboundWireFormat=text&bufferStates=true', mockoptions);
          assert.equal(s.url, 'ws://example.com?outboundWireFormat=text&bufferStates=true');
        });

        it('sets the underlying socket\'s binary type', function() {
          assert.equal(socket.binaryType, 'arraybuffer');
        });

        describe('when connection fails for authorization reasons', function() {
          it('it rejects with an authorization failure', function() {
            this.timeout(5000);
            var s = new Socket();
            var promise = s.open('ws://example.com', mockoptions);
            _socket.readyState = 1;
            _socket.emit('open');

            var firstCallArgs = JSON.parse(_socket.send.firstCall.args[0]);
            assert.equal(firstCallArgs.type, 'authorization');

            _socket.emit('close', {
              code: 1008,
              reason: 'Authentication Failed'
            });

            return assert.isRejected(promise)
              .then(function(reason) {
                assert.instanceOf(reason, Socket.AuthorizationError);
                assert.match(reason.code, 1008);
                assert.match(reason.reason, /Authentication Failed/);
                assert.match(reason.message, /Authentication Failed/);
              });
          });
        });

        describe('when connection fails for non-authorization reasons', function() {
          it('rejects with the close event\'s reason', function() {
            var s = new Socket();
            var promise = s.open('ws://example.com', mockoptions);
            _socket.emit('close', {
              code: 4001,
              reason: 'No'
            });

            return assert.isRejected(promise)
              .then(function(reason) {
                assert.instanceOf(reason, Socket.ConnectionError);
                assert.match(reason.code, 4001);
                assert.match(reason.reason, /No/);
                assert.match(reason.message, /No/);
              });
          });
        });

        describe('when the connection succeeds', function() {
          it('sends an auth message up the socket', function() {
            var firstCallArgs = JSON.parse(_socket.send.firstCall.args[0]);
            assert.property(firstCallArgs, 'id');
            assert.equal(firstCallArgs.type, 'authorization');
            assert.property(firstCallArgs, 'data');
            assert.property(firstCallArgs.data, 'token');
            assert.equal(firstCallArgs.data.token, 'mocktoken');
            assert.equal(firstCallArgs.trackingId, 'mocktrackingid');
            assert.notProperty(firstCallArgs, 'logLevelToken');
          });

          describe('when logLevelToken is set', function() {
            it('it includes the logLevelToken in the authorization payload', function() {
              var s = new Socket();
              s.open('ws://example.com', {
                forceCloseDelay: 100,
                pingInterval: 100,
                pongTimeout: 90,
                logger: console,
                token: 'mocktoken',
                trackingId: 'mocktrackingid',
                logLevelToken: 'mocklogleveltoken'
              }).catch(console.error.bind(console));
              _socket.readyState = 1;
              _socket.emit('open');

              var firstCallArgs = JSON.parse(_socket.send.firstCall.args[0]);

              assert.property(firstCallArgs, 'id');
              assert.equal(firstCallArgs.type, 'authorization');
              assert.property(firstCallArgs, 'data');
              assert.property(firstCallArgs.data, 'token');
              assert.equal(firstCallArgs.data.token, 'mocktoken');
              assert.equal(firstCallArgs.trackingId, 'mocktrackingid');
              assert.equal(firstCallArgs.logLevelToken, 'mocklogleveltoken');
            });
          });

          it('kicks off ping/pong', function() {
            assert.calledOnce(socket._ping);
          });

          it('resolves upon successful authorization', function() {
            var s = new Socket();
            var promise = s.open('ws://example.com', mockoptions);
            _socket.readyState = 1;
            _socket.emit('open');
            _socket.emit('message', {
              data: JSON.stringify({
                id: JSON.parse(_socket.send.args[1][0]).id,
                type: 'pong'
              })
            });
            return assert.isFulfilled(promise);
          });
        });

      });

      describe('#close()', function() {
        it('closes the socket', function() {
          return socket.close()
            .then(function() {
              assert.called(_socket.close);
            });
        });

        it('accepts a valid code', function() {
          return Promise.all([
            assert.isRejected(socket.close({code: 1001}), /`options.code` must be 1000 or between 3000 and 4999 \(inclusive\)/),
            assert.isFulfilled(socket.close({code: 1000}))
          ]);
        });

        it('accepts a reason', function() {
          return assert.isFulfilled(socket.close({
            code: 3001,
            reason: 'Custom Normal'
          }))
            .then(function() {
              assert.calledWith(_socket.close, 3001, 'Custom Normal');
            });
        });

        it('can safely be called multiple times', function() {
          var p1 = socket.close();
          _socket.readyState = 2;
          var p2 = socket.close();
          return Promise.all([p1, p2]);
        });

        it('signals close if no close frame received within a specified window', function() {
          var s = new Socket();
          var promise = s.open('ws://example.com', mockoptions);
          _socket.readyState = 1;
          _socket.emit('open');
          _socket.emit('message', {
            data: JSON.stringify({
              id: JSON.parse(_socket.send.args[1][0]).id,
              type: 'pong'
            })
          });
          return promise
            .then(function() {
              var spy = sinon.spy();
              s.on('close', spy);
              _socket.close = function() {return new Promise(function() {});};
              _socket.removeAllListeners('close');

              return s.close()
                .then(delay.bind(null, 500))
                .then(function() {
                  assert.called(spy);
                  assert.calledWith(spy, {
                    code: 1000,
                    reason: 'Done (forced)'
                  });
                });
            });
        });

        it('cancels any outstanding ping/pong timers', function() {
          socket._ping.reset();
          var spy = sinon.spy();
          socket.on('close', spy);
          socket._ping();
          socket.close();
          return delay(500)
            .then(function() {
              assert.neverCalledWith(spy, {
                code: 1000,
                reason: 'Pong not received'
              });
              assert.calledOnce(socket._ping);
            });
        });
      });

      describe('#send()', function() {
        describe('when the socket is not in the OPEN state', function() {
          it('fails', function() {
            _socket.readyState = 0;
            return assert.isRejected(socket.send('test'), /INVALID_STATE_ERROR/)
              .then(function() {
                _socket.readyState = 1;
                return assert.isFulfilled(socket.send('test'));
              })
              .then(function() {
                _socket.readyState = 2;
                return assert.isRejected(socket.send('test')), /INVALID_STATE_ERROR/;
              })
              .then(function() {
                _socket.readyState = 3;
                return assert.isRejected(socket.send('test')), /INVALID_STATE_ERROR/;
              });
          });
        });

        it('sends strings', function() {
          socket.send('this is a string');
          assert.calledWith(_socket.send, 'this is a string');
        });

        it('sends JSON.stringifyable objects', function() {
          socket.send({
            json: true
          });
          assert.calledWith(_socket.send, '{"json":true}');
        });
      });

      describe('#onclose()', function() {
        it('disables further ping checks', function() {
          socket._ping.reset();
          var spy = sinon.spy();
          socket.on('close', spy);
          socket._ping();
          _socket.emit('close', {
            code: 1000,
            reason: 'Done'
          });
          return delay(500)
            .then(function() {
              assert.neverCalledWith(spy, {
                code: 1000,
                reason: 'Pong not received'
              });
              assert.calledOnce(socket._ping);
            });
        });

        describe('when it receives close code 1005', function() {
          forEach({
            Replaced: 4000,
            'Authentication Failed': 1008,
            'Authentication did not happen within the timeout window of 30000 seconds.': 1008
          }, function(code, reason) {
            it('emits code ' + code + ' for reason ' + reason, function() {
              var spy = sinon.spy();
              socket.on('close', spy);

              _socket.emit('close', {
                code: 1005,
                reason: reason
              });
              assert.called(spy);
              assert.calledWith(spy, {
                code: code,
                reason: reason
              });
            });
          });
        });
      });

      describe('#onmessage()', function() {
        var spy;
        beforeEach(function() {
          spy = sinon.spy();
          socket.on('message', spy);
        });

        it('emits messages from the underlying socket', function() {
          _socket.emit('message', {
            data: JSON.stringify({
              sequenceNumber: 3,
              id: 'mockid'
            })
          });

          assert.called(spy);
        });

        it('parses received messages', function() {
          _socket.emit('message', {
            data: JSON.stringify({
              sequenceNumber: 3,
              id: 'mockid'
            })
          });

          assert.calledWith(spy, {
            data: {
              sequenceNumber: 3,
              id: 'mockid'
            }
          });
        });

        it('emits skipped sequence numbers', function() {
          var spy2 = sinon.spy();
          socket.on('sequence-mismatch', spy2);

          _socket.emit('message', {
            data: JSON.stringify({
              sequenceNumber: 5,
              id: 'mockid'
            })
          });
          assert.notCalled(spy2);

          _socket.emit('message', {
            data: JSON.stringify({
              sequenceNumber: 7,
              id: 'mockid'
            })
          });
          assert.calledOnce(spy2);
          assert.calledWith(spy2, 7, 6);
        });


        it('acknowledges received messages', function() {
          sinon.spy(socket, '_acknowledge');
          _socket.emit('message', {
            data: JSON.stringify({
              sequenceNumber: 5,
              id: 'mockid'
            })
          });
          assert.called(socket._acknowledge);
          assert.calledWith(socket._acknowledge, {
            data: {
              sequenceNumber: 5,
              id: 'mockid'
            }
          });
        });

        it('emits pongs separately from other messages', function() {
          var pongSpy = sinon.spy();
          socket.on('pong', pongSpy);

          _socket.emit('message', {
            data: JSON.stringify({
              sequenceNumber: 5,
              id: 'mockid1',
              type: 'pong'
            })
          });

          assert.calledOnce(pongSpy);
          assert.notCalled(spy);

          _socket.emit('message', {
            data: JSON.stringify({
              sequenceNumber: 6,
              id: 'mockid2'
            })
          });

          assert.calledOnce(pongSpy);
          assert.calledOnce(spy);
        });
      });

      describe('#_acknowledge()', function() {
        it('requires a message id', function() {
          return assert.isRejected(socket._acknowledge(), /`event.data.id` is required/);
        });

        it('acknowledges the specified message', function() {
          var id = 'mockuuid';

          return socket._acknowledge({
            data: {
              type: 'not an ack',
              id: id
            }
          })
            .then(function() {
              assert.calledWith(_socket.send, JSON.stringify({
                messageId: id,
                type: 'ack'
              }));
            });
        });
      });

      describe('#_ping()', function() {
        var id;

        beforeEach(function() {
          id = Date.now();
        });

        it('sends a ping up the socket', function() {
          socket._ping(id);
          assert.calledWith(_socket.send, JSON.stringify({
            id: id,
            type: 'ping'
          }));
        });

        it('considers the socket closed if no pong is received in an acceptable time period', function() {
          var spy = sinon.spy();
          socket.on('close', spy);

          socket._ping(id);

          return delay(200)
            .then(function() {
              assert.called(spy);
              assert.calledWith(spy, {
                code: 1000,
                reason: 'Pong not received'
              });
            });
        });

        it('schedules a future ping', function() {
          assert.callCount(socket._ping, 1);
          return delay(100)
            .then(function() {
              assert.callCount(socket._ping, 2);
            });
        });

        it('closes the socket when an unexpected pong is received', function() {
          var spy = sinon.spy();
          socket.on('close', spy);

          socket._ping(2);
          _socket.emit('message', {
            data: JSON.stringify({
              type: 'pong',
              id: 1
            })
          });

          assert.calledWith(spy, {
            code: 1000,
            reason: 'Pong mismatch'
          });
        });
      });
    });
  });
});
