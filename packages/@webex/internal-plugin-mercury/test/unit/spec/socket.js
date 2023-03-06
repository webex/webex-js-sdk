/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {forEach} from 'lodash';
import {assert} from '@webex/test-helper-chai';
import MockWebSocket from '@webex/test-helper-mock-web-socket';
import sinon from 'sinon';
import {
  BadRequest,
  NotAuthorized,
  Forbidden,
  // NotFound,
  config,
  ConnectionError,
  Socket,
} from '@webex/internal-plugin-mercury';
import uuid from 'uuid';
import FakeTimers from '@sinonjs/fake-timers';

describe('plugin-mercury', () => {
  describe('Socket', () => {
    let clock, mockWebSocket, socket;

    const mockoptions = Object.assign(
      {
        logger: console,
        token: 'mocktoken',
        trackingId: 'mocktrackingid',
      },
      config.mercury
    );

    beforeEach(() => {
      clock = FakeTimers.install({now: Date.now()});
    });

    afterEach(() => {
      clock.uninstall();
    });

    beforeEach(() => {
      sinon.stub(Socket, 'getWebSocketConstructor').callsFake(() => function (...args) {
        mockWebSocket = new MockWebSocket(...args);

            return mockWebSocket;
          }
      );

      sinon.spy(Socket.prototype, '_ping');

      socket = new Socket();
      const promise = socket.open('ws://example.com', mockoptions);

      mockWebSocket.open();

      return promise;
    });

    afterEach(() => {
      Socket.getWebSocketConstructor.restore();
      if (Socket.prototype._ping.restore) {
        Socket.prototype._ping.restore();
      }

      return Promise.resolve(socket && socket.close()).then(() => {
        mockWebSocket = undefined;
        socket = undefined;
      });
    });

    describe.skip('#open()', () => {
      let socket;

      beforeEach(() => {
        socket = new Socket();
      });

      afterEach(() => socket.close().catch(() => console.log()));

      it('requires a url', () => assert.isRejected(socket.open(), /`url` is required/));

      it('requires a forceCloseDelay option', () =>
        assert.isRejected(
          socket.open('ws://example.com'),
          /missing required property forceCloseDelay/
        ));

      it('requires a pingInterval option', () =>
        assert.isRejected(
          socket.open('ws://example.com', {
            forceCloseDelay: mockoptions.forceCloseDelay,
          }),
          /missing required property pingInterval/
        ));

      it('requires a pongTimeout option', () =>
        assert.isRejected(
          socket.open('ws://example.com', {
            forceCloseDelay: mockoptions.forceCloseDelay,
            pingInterval: mockoptions.pingInterval,
          }),
          /missing required property pongTimeout/
        ));

      it('requires a token option', () =>
        assert.isRejected(
          socket.open('ws://example.com', {
            forceCloseDelay: mockoptions.forceCloseDelay,
            pingInterval: mockoptions.pingInterval,
            pongTimeout: mockoptions.pongTimeout,
          }),
          /missing required property token/
        ));

      it('requires a trackingId option', () =>
        assert.isRejected(
          socket.open('ws://example.com', {
            forceCloseDelay: mockoptions.forceCloseDelay,
            pingInterval: mockoptions.pingInterval,
            pongTimeout: mockoptions.pongTimeout,
            token: 'mocktoken',
          }),
          /missing required property trackingId/
        ));

      it('requires a logger option', () =>
        assert.isRejected(
          socket.open('ws://example.com', {
            forceCloseDelay: mockoptions.forceCloseDelay,
            pingInterval: mockoptions.pingInterval,
            pongTimeout: mockoptions.pongTimeout,
            token: 'mocktoken',
            trackingId: 'mocktrackingid',
          }),
          /missing required property logger/
        ));

      it('accepts a logLevelToken option', () => {
        const promise = socket.open('ws://example.com', {
          forceCloseDelay: mockoptions.forceCloseDelay,
          pingInterval: mockoptions.pingInterval,
          pongTimeout: mockoptions.pongTimeout,
          logger: console,
          token: 'mocktoken',
          trackingId: 'mocktrackingid',
          logLevelToken: 'mocklogleveltoken',
        });

        mockWebSocket.readyState = 1;
        mockWebSocket.emit('open');

        mockWebSocket.emit('message', {
          data: JSON.stringify({
            id: uuid.v4(),
            data: {
              eventType: 'mercury.buffer_state',
            },
          }),
        });

        return promise.then(() => {
          assert.equal(socket.logLevelToken, 'mocklogleveltoken');
        });
      });
    });

    describe('#binaryType', () => {
      it('proxies to the underlying socket', () => {
        assert.notEqual(socket.binaryType, 'test');
        mockWebSocket.binaryType = 'test';
        assert.equal(socket.binaryType, 'test');
      });
    });

    describe('#bufferedAmount', () => {
      it('proxies to the underlying socket', () => {
        assert.notEqual(socket.bufferedAmount, 'test');
        mockWebSocket.bufferedAmount = 'test';
        assert.equal(socket.bufferedAmount, 'test');
      });
    });

    describe('#extensions', () => {
      it('proxies to the underlying socket', () => {
        assert.notEqual(socket.extensions, 'test');
        mockWebSocket.extensions = 'test';
        assert.equal(socket.extensions, 'test');
      });
    });

    describe('#protocol', () => {
      it('proxies to the underlying socket', () => {
        assert.notEqual(socket.protocol, 'test');
        mockWebSocket.protocol = 'test';
        assert.equal(socket.protocol, 'test');
      });
    });

    describe('#readyState', () => {
      it('proxies to the underlying socket', () => {
        assert.notEqual(socket.readyState, 'test');
        mockWebSocket.readyState = 'test';
        assert.equal(socket.readyState, 'test');
      });
    });

    describe('#url', () => {
      it('proxies to the underlying socket', () => {
        assert.notEqual(socket.url, 'test');
        mockWebSocket.url = 'test';
        assert.equal(socket.url, 'test');
      });
    });

    describe.skip('#open()', () => {
      it('requires a url parameter', () => {
        const s = new Socket();

        return assert.isRejected(s.open(), /`url` is required/);
      });

      it('cannot be called more than once', () =>
        assert.isRejected(
          socket.open('ws://example.com'),
          /Socket#open\(\) can only be called once/
        ));

      it("sets the underlying socket's binary type", () =>
        assert.equal(socket.binaryType, 'arraybuffer'));

      describe('when connection fails because this is a service account', () => {
        it('rejects with a BadRequest', () => {
          const s = new Socket();
          const promise = s.open('ws://example.com', mockoptions);

          mockWebSocket.readyState = 1;
          mockWebSocket.emit('open');

          const firstCallArgs = JSON.parse(mockWebSocket.send.firstCall.args[0]);

          assert.equal(firstCallArgs.type, 'authorization');

          mockWebSocket.emit('close', {
            code: 4400,
            reason: "Service accounts can't use this endpoint",
          });

          return assert.isRejected(promise).then((reason) => {
            assert.instanceOf(reason, BadRequest);
            assert.match(reason.code, 4400);
            assert.match(reason.reason, /Service accounts can't use this endpoint/);
            assert.match(reason.message, /Service accounts can't use this endpoint/);

            return s.close();
          });
        });
      });

      describe('when connection fails because of an invalid token', () => {
        it('rejects with a NotAuthorized', () => {
          const s = new Socket();
          const promise = s.open('ws://example.com', mockoptions);

          mockWebSocket.readyState = 1;
          mockWebSocket.emit('open');

          const firstCallArgs = JSON.parse(mockWebSocket.send.firstCall.args[0]);

          assert.equal(firstCallArgs.type, 'authorization');

          mockWebSocket.emit('close', {
            code: 4401,
            reason: 'Authorization Failed',
          });

          return assert.isRejected(promise).then((reason) => {
            assert.instanceOf(reason, NotAuthorized);
            assert.match(reason.code, 4401);
            assert.match(reason.reason, /Authorization Failed/);
            assert.match(reason.message, /Authorization Failed/);

            return s.close();
          });
        });
      });

      describe('when connection fails because of a missing entitlement', () => {
        it('rejects with a Forbidden', () => {
          const s = new Socket();
          const promise = s.open('ws://example.com', mockoptions);

          mockWebSocket.readyState = 1;
          mockWebSocket.emit('open');

          const firstCallArgs = JSON.parse(mockWebSocket.send.firstCall.args[0]);

          assert.equal(firstCallArgs.type, 'authorization');

          mockWebSocket.emit('close', {
            code: 4403,
            reason: 'Not entitled',
          });

          return assert.isRejected(promise).then((reason) => {
            assert.instanceOf(reason, Forbidden);
            assert.match(reason.code, 4403);
            assert.match(reason.reason, /Not entitled/);
            assert.match(reason.message, /Not entitled/);

            return s.close();
          });
        });
      });

      // describe(`when connection fails because the websocket registation has expired`, () => {
      //   it(`rejects with a NotFound`, () => {
      //     const s = new Socket();
      //     const promise = s.open(`ws://example.com`, mockoptions);
      //     mockWebSocket.readyState = 1;
      //     mockWebSocket.emit(`open`);
      //
      //     const firstCallArgs = JSON.parse(mockWebSocket.send.firstCall.args[0]);
      //     assert.equal(firstCallArgs.type, `authorization`);
      //
      //     mockWebSocket.emit(`close`, {
      //       code: 4404,
      //       reason: `Expired registration`
      //     });
      //
      //     return assert.isRejected(promise)
      //       .then((reason) => {
      //         assert.instanceOf(reason, NotFound);
      //         assert.match(reason.code, 4404);
      //         assert.match(reason.reason, /Expired registration/);
      //         assert.match(reason.message, /Expired registration/);
      //         return s.close();
      //       });
      //   });
      // });

      describe('when connection fails for non-authorization reasons', () => {
        it("rejects with the close event's reason", () => {
          const s = new Socket();
          const promise = s.open('ws://example.com', mockoptions);

          mockWebSocket.emit('close', {
            code: 4001,
            reason: 'No',
          });

          return assert.isRejected(promise).then((reason) => {
            assert.instanceOf(reason, ConnectionError);
            assert.match(reason.code, 4001);
            assert.match(reason.reason, /No/);
            assert.match(reason.message, /No/);

            return s.close();
          });
        });
      });

      describe('when the connection succeeds', () => {
        it('sends an auth message up the socket', () => {
          const firstCallArgs = JSON.parse(mockWebSocket.send.firstCall.args[0]);

          assert.property(firstCallArgs, 'id');
          assert.equal(firstCallArgs.type, 'authorization');
          assert.property(firstCallArgs, 'data');
          assert.property(firstCallArgs.data, 'token');
          assert.equal(firstCallArgs.data.token, 'mocktoken');
          assert.equal(firstCallArgs.trackingId, 'mocktrackingid');
          assert.notProperty(firstCallArgs, 'logLevelToken');
        });

        describe('when logLevelToken is set', () => {
          it('includes the logLevelToken in the authorization payload', () => {
            const s = new Socket();

            s.open('ws://example.com', {
              forceCloseDelay: mockoptions.forceCloseDelay,
              pingInterval: mockoptions.pingInterval,
              pongTimeout: mockoptions.pongTimeout,
              logger: console,
              token: 'mocktoken',
              trackingId: 'mocktrackingid',
              logLevelToken: 'mocklogleveltoken',
            }).catch((reason) => console.error(reason));
            mockWebSocket.readyState = 1;
            mockWebSocket.emit('open');

            const firstCallArgs = JSON.parse(mockWebSocket.send.firstCall.args[0]);

            assert.property(firstCallArgs, 'id');
            assert.equal(firstCallArgs.type, 'authorization');
            assert.property(firstCallArgs, 'data');
            assert.property(firstCallArgs.data, 'token');
            assert.equal(firstCallArgs.data.token, 'mocktoken');
            assert.equal(firstCallArgs.trackingId, 'mocktrackingid');
            assert.equal(firstCallArgs.logLevelToken, 'mocklogleveltoken');

            return s.close();
          });
        });

        it('kicks off ping/ping', () => assert.calledOnce(socket._ping));

        it('resolves upon successful authorization', () => {
          const s = new Socket();
          const promise = s.open('ws://example.com', mockoptions);

          mockWebSocket.readyState = 1;
          mockWebSocket.emit('open');
          mockWebSocket.emit('message', {
            data: JSON.stringify({
              id: uuid.v4(),
              data: {
                eventType: 'mercury.buffer_state',
              },
            }),
          });

          return promise.then(() => s.close());
        });

        it('resolves upon receiving registration status', () => {
          const s = new Socket();
          const promise = s.open('ws://example.com', mockoptions);

          mockWebSocket.readyState = 1;
          mockWebSocket.emit('open');
          mockWebSocket.emit('message', {
            data: JSON.stringify({
              id: uuid.v4(),
              data: {
                eventType: 'mercury.registration_status',
              },
            }),
          });

          return promise.then(() => s.close());
        });
      });
    });

    describe('#close()', () => {
      it('closes the socket', () => socket.close().then(() => assert.called(mockWebSocket.close)));

      it('only accepts valid close codes', () =>
        Promise.all([
          assert.isRejected(
            socket.close({code: 1001}),
            /`options.code` must be 1000 or between 3000 and 4999 \(inclusive\)/
          ),
          socket.close({code: 1000}),
        ]));

      it('accepts a reason', () =>
        socket
          .close({
            code: 3001,
            reason: 'Custom Normal',
          })
          .then(() => assert.calledWith(mockWebSocket.close, 3001, 'Custom Normal')));

      it('can safely be called called multiple times', () => {
        const p1 = socket.close();

        mockWebSocket.readyState = 2;
        const p2 = socket.close();

        return Promise.all([p1, p2]);
      });

      it('signals closure if no close frame is received within the specified window', () => {
        const socket = new Socket();
        const promise = socket.open('ws://example.com', mockoptions);

        mockWebSocket.readyState = 1;
        mockWebSocket.emit('open');
        mockWebSocket.emit('message', {
          data: JSON.stringify({
            id: uuid.v4(),
            data: {
              eventType: 'mercury.buffer_state',
            },
          }),
        });

        return promise.then(() => {
          const spy = sinon.spy();

          socket.on('close', spy);
          mockWebSocket.close = () =>
            new Promise(() => {
              /* eslint no-inline-comments: [0] */
            });
          mockWebSocket.removeAllListeners('close');

          const promise = socket.close();

          clock.tick(mockoptions.forceCloseDelay);

          return promise.then(() => {
            assert.called(spy);
            assert.calledWith(spy, {
              code: 1000,
              reason: 'Done (forced)',
            });
          });
        });
      });

      it('cancels any outstanding ping/pong timers', () => {
        mockWebSocket.send = sinon.stub();
        socket._ping.resetHistory();
        const spy = sinon.spy();

        socket.on('close', spy);
        socket._ping();
        socket.close();
        clock.tick(2 * mockoptions.pingInterval);
        assert.neverCalledWith(spy, {
          code: 1000,
          reason: 'Pong not received',
        });
        assert.calledOnce(socket._ping);
      });
    });

    describe('#send()', () => {
      describe('when the socket is not in the OPEN state', () => {
        it('fails', () => {
          mockWebSocket.readyState = 0;

          return assert
            .isRejected(socket.send('test0'), /INVALID_STATE_ERROR/)
            .then(() => {
              mockWebSocket.readyState = 2;

              return assert.isRejected(socket.send('test2'), /INVALID_STATE_ERROR/);
            })
            .then(() => {
              mockWebSocket.readyState = 3;

              return assert.isRejected(socket.send('test3'), /INVALID_STATE_ERROR/);
            })
            .then(() => {
              mockWebSocket.readyState = 1;

              return socket.send('test1');
            });
        });
      });

      it('sends strings', () => {
        socket.send('this is a string');
        assert.calledWith(mockWebSocket.send, 'this is a string');
      });

      it('sends JSON.stringifyable object', () => {
        socket.send({
          json: true,
        });
        assert.calledWith(mockWebSocket.send, '{"json":true}');
      });
    });

    describe.skip('#onclose()', () => {
      it('stops further ping checks', () => {
        socket._ping.resetHistory();
        assert.notCalled(socket._ping);
        const spy = sinon.spy();

        assert.notCalled(socket._ping);
        socket.on('close', spy);
        assert.notCalled(socket._ping);
        socket._ping();
        assert.calledOnce(socket._ping);
        mockWebSocket.emit('close', {
          code: 1000,
          reason: 'Done',
        });
        assert.calledOnce(socket._ping);
        clock.tick(5 * mockoptions.pingInterval);
        assert.neverCalledWith(spy, {
          code: 1000,
          reason: 'Pong not received',
        });
        assert.calledOnce(socket._ping);
      });

      describe('when it receives close code 1005', () => {
        forEach(
          {
            Replaced: 4000,
            'Authentication Failed': 1008,
            'Authentication did not happen within the timeout window of 30000 seconds.': 1008,
          },
          (code, reason) => {
            it(`emits code ${code} for reason ${reason}`, () => {
              const spy = sinon.spy();

              socket.on('close', spy);

              mockWebSocket.emit('close', {
                code: 1005,
                reason,
              });
              assert.called(spy);
              assert.calledWith(spy, {
                code,
                reason,
              });
            });
          }
        );
      });
    });

    describe('#onmessage()', () => {
      let spy;

      beforeEach(() => {
        spy = sinon.spy();
        socket.on('message', spy);
      });

      it('emits messages from the underlying socket', () => {
        mockWebSocket.emit('message', {
          data: JSON.stringify({
            sequenceNumber: 3,
            id: 'mockid',
          }),
        });

        assert.called(spy);
      });

      it('parses received messages', () => {
        mockWebSocket.emit('message', {
          data: JSON.stringify({
            sequenceNumber: 3,
            id: 'mockid',
          }),
        });

        assert.calledWith(spy, {
          data: {
            sequenceNumber: 3,
            id: 'mockid',
          },
        });
      });

      it('emits skipped sequence numbers', () => {
        const spy2 = sinon.spy();

        socket.on('sequence-mismatch', spy2);

        mockWebSocket.emit('message', {
          data: JSON.stringify({
            sequenceNumber: 2,
            id: 'mockid',
          }),
        });
        assert.notCalled(spy2);

        mockWebSocket.emit('message', {
          data: JSON.stringify({
            sequenceNumber: 4,
            id: 'mockid',
          }),
        });
        assert.calledOnce(spy2);
        assert.calledWith(spy2, 4, 3);
      });

      it('acknowledges received messages', () => {
        sinon.spy(socket, '_acknowledge');
        mockWebSocket.emit('message', {
          data: JSON.stringify({
            sequenceNumber: 5,
            id: 'mockid',
          }),
        });
        assert.called(socket._acknowledge);
        assert.calledWith(socket._acknowledge, {
          data: {
            sequenceNumber: 5,
            id: 'mockid',
          },
        });
      });

      it('emits pongs separately from other messages', () => {
        const pongSpy = sinon.spy();

        socket.on('pong', pongSpy);

        mockWebSocket.emit('message', {
          data: JSON.stringify({
            sequenceNumber: 5,
            id: 'mockid1',
            type: 'pong',
          }),
        });

        assert.calledOnce(pongSpy);
        assert.notCalled(spy);

        mockWebSocket.emit('message', {
          data: JSON.stringify({
            sequenceNumber: 6,
            id: 'mockid2',
          }),
        });

        assert.calledOnce(pongSpy);
        assert.calledOnce(spy);
      });
    });

    describe('#_acknowledge', () => {
      it('requires an event', () =>
        assert.isRejected(socket._acknowledge(), /`event` is required/));

      it('requires a message id', () =>
        assert.isRejected(socket._acknowledge({}), /`event.data.id` is required/));

      it('acknowledges the specified message', () => {
        const id = 'mockuuid';

        return socket
          ._acknowledge({
            data: {
              type: 'not an ack',
              id,
            },
          })
          .then(() => {
            assert.calledWith(
              mockWebSocket.send,
              JSON.stringify({
                messageId: id,
                type: 'ack',
              })
            );
          });
      });
    });

    describe.skip('#_ping()', () => {
      let id;

      beforeEach(() => {
        id = uuid.v4();
      });

      it('sends a ping up the socket', () =>
        socket._ping(id).then(() => {
          assert.calledWith(
            mockWebSocket.send,
            JSON.stringify({
              id,
              type: 'ping',
            })
          );
        }));

      it('considers the socket closed if no pong is received in an acceptable time period', () => {
        const spy = sinon.spy();

        socket.on('close', spy);

        mockWebSocket.send = sinon.stub();
        socket._ping(id);
        clock.tick(2 * mockoptions.pongTimeout);
        assert.called(spy);
        assert.calledWith(spy, {
          code: 1000,
          reason: 'Pong not received',
        });
      });

      it('schedules a future ping', () => {
        assert.callCount(socket._ping, 1);
        clock.tick(mockoptions.pingInterval);
        assert.callCount(socket._ping, 2);
      });

      it('closes the socket when an unexpected pong is received', () => {
        const spy = sinon.spy();

        socket.on('close', spy);

        socket._ping(2);
        mockWebSocket.emit('message', {
          data: JSON.stringify({
            type: 'pong',
            id: 1,
          }),
        });

        assert.calledWith(spy, {
          code: 1000,
          reason: 'Pong mismatch',
        });
      });
    });
  });
});
