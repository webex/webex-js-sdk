/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {randomUUID} from 'crypto';
import {forEach} from 'lodash';
import {assert} from '@webex/test-helper-chai';
import MockWebSocket from '@webex/test-helper-mock-web-socket';
import sinon from 'sinon';
import {BadRequest, NotAuthorized, Forbidden, ConnectionError} from './errors';
import config from './config';
import Socket from './socket';
import {MESSAGE_TYPES} from './socket/constants';

if (!crypto.randomUUID) {
  Object.defineProperty(crypto, 'randomUUID', {
    value: randomUUID,
    configurable: true,
  });
}

describe('plugin-mobius-socket', () => {
  describe('Socket', () => {
    let mockWebSocket;
    let socket;
    let usingFakeTimers;

    const mockoptions = {
      logger: console,
      token: 'mocktoken',
      trackingId: 'mocktrackingid',
      ...config.mobiusSocket,
    };

    const emitAuthResponse = ({statusCode = 200, statusMessage = 'OK'} = {}) => {
      const authRequest = JSON.parse(mockWebSocket.send.lastCall.args[0]);

      mockWebSocket.emit('message', {
        data: JSON.stringify({
          type: 'response_event',
          subtype: MESSAGE_TYPES.AUTH,
          trackingId: authRequest.trackingId,
          statusCode,
          statusMessage,
        }),
      });
    };

    beforeEach(() => {
      jest.useFakeTimers({doNotFake: ['nextTick']});
      usingFakeTimers = true;
    });

    beforeEach(() => {
      sinon.stub(Socket, 'getWebSocketConstructor').callsFake(
        () =>
          function (...args) {
            mockWebSocket = new MockWebSocket(...args);

            return mockWebSocket;
          }
      );

      socket = new Socket();
      const promise = socket.open('ws://example.com', mockoptions);

      mockWebSocket.open();
      // Simulate Mobius auth response (MockWebSocket.open auto-sends mercury.buffer_state which Mobius ignores)
      process.nextTick(() => {
        emitAuthResponse();
      });

      return promise;
    });

    afterEach(() => {
      if (usingFakeTimers) {
        jest.useRealTimers();
        usingFakeTimers = false;
      }

      Socket.getWebSocketConstructor.restore();

      return Promise.resolve(socket && socket.close()).then(() => {
        mockWebSocket = undefined;
        socket = undefined;
      });
    });

    describe('#open()', () => {
      let freshSocket;

      beforeEach(() => {
        freshSocket = new Socket();
      });

      afterEach(() => freshSocket.close().catch(() => undefined));

      it('requires a url', () => assert.isRejected(freshSocket.open(), /`url` is required/));

      it('requires a forceCloseDelay option', () =>
        assert.isRejected(
          freshSocket.open('ws://example.com'),
          /missing required property forceCloseDelay/
        ));

      it('requires a token option', () =>
        assert.isRejected(
          freshSocket.open('ws://example.com', {
            forceCloseDelay: mockoptions.forceCloseDelay,
          }),
          /missing required property token/
        ));

      it('requires a trackingId option', () =>
        assert.isRejected(
          freshSocket.open('ws://example.com', {
            forceCloseDelay: mockoptions.forceCloseDelay,
            token: 'mocktoken',
          }),
          /missing required property trackingId/
        ));

      it('requires a logger option', () =>
        assert.isRejected(
          freshSocket.open('ws://example.com', {
            forceCloseDelay: mockoptions.forceCloseDelay,
            token: 'mocktoken',
            trackingId: 'mocktrackingid',
          }),
          /missing required property logger/
        ));

      it('accepts a logLevelToken option', () => {
        const openPromise = freshSocket.open('ws://example.com', {
          forceCloseDelay: mockoptions.forceCloseDelay,
          wssResponseTimeout: mockoptions.wssResponseTimeout,
          logger: console,
          token: 'mocktoken',
          trackingId: 'mocktrackingid',
          logLevelToken: 'mocklogleveltoken',
        });

        mockWebSocket.readyState = 1;
        mockWebSocket.emit('open');

        emitAuthResponse();

        return openPromise.then(() => {
          assert.equal(freshSocket.logLevelToken, 'mocklogleveltoken');
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

    describe('#open()', () => {
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

          assert.equal(firstCallArgs.type, MESSAGE_TYPES.AUTH);

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

          assert.equal(firstCallArgs.type, MESSAGE_TYPES.AUTH);

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

          assert.equal(firstCallArgs.type, MESSAGE_TYPES.AUTH);

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

          assert.equal(firstCallArgs.type, MESSAGE_TYPES.AUTH);
          assert.property(firstCallArgs, 'data');
          assert.property(firstCallArgs.data, 'token');
          assert.equal(firstCallArgs.data.token, 'mocktoken');
          assert.property(firstCallArgs, 'trackingId');
        });

        describe('when logLevelToken is set', () => {
          it('includes auth payload with token', () => {
            const s = new Socket();

            s.open('ws://example.com', {
              forceCloseDelay: mockoptions.forceCloseDelay,
              wssResponseTimeout: mockoptions.wssResponseTimeout,
              logger: console,
              token: 'mocktoken',
              trackingId: 'mocktrackingid',
            }).catch((reason) => console.error(reason));
            mockWebSocket.readyState = 1;
            mockWebSocket.emit('open');

            const firstCallArgs = JSON.parse(mockWebSocket.send.firstCall.args[0]);

            assert.equal(firstCallArgs.type, MESSAGE_TYPES.AUTH);
            assert.property(firstCallArgs, 'data');
            assert.equal(firstCallArgs.data.token, 'mocktoken');
            assert.property(firstCallArgs, 'trackingId');

            return s.close();
          });
        });

        it('resolves upon receiving response_event auth response', () => {
          const s = new Socket();
          const promise = s.open('ws://example.com', mockoptions);

          mockWebSocket.readyState = 1;
          mockWebSocket.emit('open');
          emitAuthResponse();

          return promise.then(() => s.close());
        });

        it('rejects upon receiving a non-2xx auth response_event', () => {
          const s = new Socket();
          const promise = s.open('ws://example.com', mockoptions);

          mockWebSocket.readyState = 1;
          mockWebSocket.emit('open');
          emitAuthResponse({statusCode: 401, statusMessage: 'Unauthorized'});

          return assert.isRejected(promise).then((reason) => {
            assert.equal(reason.name, 'MobiusSocketResponseError');
            assert.equal(reason.statusCode, 401);
            assert.match(reason.statusMessage, /Unauthorized/);

            return s.close();
          });
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

      it('accepts the logout reason', () =>
        socket
          .close({
            code: 3050,
            reason: 'done (permanent)',
          })
          .then(() => assert.calledWith(mockWebSocket.close, 3050, 'done (permanent)')));

      it('can safely be called called multiple times', () => {
        const p1 = socket.close();

        mockWebSocket.readyState = 2;
        const p2 = socket.close();

        return Promise.all([p1, p2]);
      });

      it('signals closure if no close frame is received within the specified window', () => {
        const transientSocket = new Socket();
        const openPromise = transientSocket.open('ws://example.com', mockoptions);

        mockWebSocket.readyState = 1;
        mockWebSocket.emit('open');
        emitAuthResponse();

        return openPromise.then(() => {
          const spy = sinon.spy();

          transientSocket.on('close', spy);
          mockWebSocket.close = () =>
            new Promise(() => {
              /* eslint no-inline-comments: [0] */
            });
          mockWebSocket.removeAllListeners('close');

          const closePromise = transientSocket.close();

          jest.advanceTimersByTime(mockoptions.forceCloseDelay);

          return closePromise.then(() => {
            assert.called(spy);
            assert.calledWith(spy, {
              code: 1000,
              reason: 'Done (forced)',
            });
          });
        });
      });

      it('signals closure if no close frame is received within the specified window, but uses the initial options as 3050 if specified by options call', () => {
        const transientSocket = new Socket();
        const openPromise = transientSocket.open('ws://example.com', mockoptions);

        mockWebSocket.readyState = 1;
        mockWebSocket.emit('open');
        emitAuthResponse();

        return openPromise.then(() => {
          const spy = sinon.spy();

          transientSocket.on('close', spy);
          mockWebSocket.close = () =>
            new Promise(() => {
              /* eslint no-inline-comments: [0] */
            });
          mockWebSocket.removeAllListeners('close');

          const closePromise = transientSocket.close({code: 3050, reason: 'done (permanent)'});

          jest.advanceTimersByTime(mockoptions.forceCloseDelay);

          return closePromise.then(() => {
            assert.called(spy);
            assert.calledWith(spy, {
              code: 3050,
              reason: 'done (permanent)',
            });
          });
        });
      });

      it('signals closure if no close frame is received within the specified window, and uses default options as 1000 if the code is not 3050', () => {
        const transientSocket = new Socket();
        const openPromise = transientSocket.open('ws://example.com', mockoptions);

        mockWebSocket.readyState = 1;
        mockWebSocket.emit('open');
        emitAuthResponse();

        return openPromise.then(() => {
          const spy = sinon.spy();

          transientSocket.on('close', spy);
          mockWebSocket.close = () =>
            new Promise(() => {
              /* eslint no-inline-comments: [0] */
            });
          mockWebSocket.removeAllListeners('close');

          const closePromise = transientSocket.close({code: 1000, reason: 'test'});

          jest.advanceTimersByTime(mockoptions.forceCloseDelay);

          return closePromise.then(() => {
            assert.called(spy);
            assert.calledWith(spy, {
              code: 1000,
              reason: 'test',
            });
          });
        });
      });

      it('signals closure if no close frame is received within the specified window, and uses default options as 1000 if the code is not 3050', () => {
        const transientSocket = new Socket();
        const openPromise = transientSocket.open('ws://example.com', mockoptions);

        mockWebSocket.readyState = 1;
        mockWebSocket.emit('open');
        emitAuthResponse();

        return openPromise.then(() => {
          const spy = sinon.spy();

          transientSocket.on('close', spy);
          mockWebSocket.close = () =>
            new Promise(() => {
              /* eslint no-inline-comments: [0] */
            });
          mockWebSocket.removeAllListeners('close');

          const closePromise = transientSocket.close({code: 1000});

          jest.advanceTimersByTime(mockoptions.forceCloseDelay);

          return closePromise.then(() => {
            assert.called(spy);
            assert.calledWith(spy, {
              code: 1000,
              reason: 'Done (unknown)',
            });
          });
        });
      });

      [
        {
          description: 'manually triggers close handler when socket is still connecting',
          closeOptions: {code: 3001, reason: 'Custom close while connecting'},
          expectedCode: 3001,
          expectedReason: 'Custom close while connecting',
        },
        {
          description:
            'manually triggers close handler with default code when socket is connecting',
          closeOptions: undefined,
          expectedCode: 1000,
          expectedReason: 'Done',
        },
      ].forEach(({description, closeOptions, expectedCode, expectedReason}) => {
        it(description, async () => {
          const s = new Socket();
          let socketInstance;

          // Save the current stub and replace it
          const previousStub = Socket.getWebSocketConstructor;
          Socket.getWebSocketConstructor = sinon.stub().callsFake(
            () =>
              function (...args) {
                socketInstance = new MockWebSocket(...args);

                return socketInstance;
              }
          );

          // open the socket
          s.open('ws://example.com', mockoptions);

          // Keep socket in CONNECTING state (readyState 0)
          socketInstance.readyState = 0;

          const closeSpy = sinon.spy();
          s.on('close', closeSpy);

          // Call close and await the result
          const result = await s.close(closeOptions);

          // Verify the promise resolved with the correct close event
          assert.equal(result.code, expectedCode);
          assert.equal(result.reason, expectedReason);

          // Verify close handler was called with expected code/reason
          assert.calledOnce(closeSpy);
          assert.calledWith(closeSpy, {
            code: expectedCode,
            reason: expectedReason,
          });

          // Verify the underlying socket.close was called with the correct params
          assert.calledOnce(socketInstance.close);
          assert.calledWith(socketInstance.close, expectedCode, expectedReason);

          // Restore the previous stub
          Socket.getWebSocketConstructor = previousStub;
        });
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

    describe('#onclose()', () => {
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

      describe('when it receives close code 3050', () => {
        it('emits code 3050 for code 3050', () => {
          const code = 3050;
          const reason = 'done (permanent)';
          const spy = sinon.spy();

          socket.on('close', spy);

          mockWebSocket.emit('close', {
            code,
            reason,
          });
          assert.called(spy);
          assert.calledWith(spy, {
            code,
            reason,
          });
        });
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
            id: 'mockid',
          }),
        });

        assert.called(spy);
      });

      it('parses received messages', () => {
        mockWebSocket.emit('message', {
          data: JSON.stringify({
            id: 'mockid',
            type: 'test',
          }),
        });

        assert.calledWith(spy, {
          data: {
            id: 'mockid',
            type: 'test',
          },
        });
      });

      it('preserves top-level type and eventId for async_event envelopes', () => {
        mockWebSocket.emit('message', {
          data: JSON.stringify({
            type: 'async_event',
            trackingId: 'SRV_bb000000-0000-0000-0000-000000000006',
            eventId: 'f6a7b8c9-d0e1-2345-fabc-456789012345',
            data: {
              eventType: 'mobius.callinfo',
              callId: 'fcf86aa5-5539-4c9f-8b72-667786ae9b6c',
              deviceId: '334f3d50-1d26-4712-93f1-4972390cc565',
            },
          }),
        });

        assert.calledWith(spy, {
          data: {
            type: 'async_event',
            trackingId: 'SRV_bb000000-0000-0000-0000-000000000006',
            eventId: 'f6a7b8c9-d0e1-2345-fabc-456789012345',
            data: {
              eventType: 'mobius.callinfo',
              callId: 'fcf86aa5-5539-4c9f-8b72-667786ae9b6c',
              deviceId: '334f3d50-1d26-4712-93f1-4972390cc565',
            },
          },
        });
      });

      it('acknowledges async_event messages only', () => {
        sinon.spy(socket, 'acknowledge');
        mockWebSocket.emit('message', {
          data: JSON.stringify({
            type: 'async_event',
            eventId: 'event-123',
            trackingId: 'tracking-123',
          }),
        });
        assert.called(socket.acknowledge);
      });

      it('does not acknowledge non-async_event messages', () => {
        sinon.spy(socket, 'acknowledge');
        mockWebSocket.emit('message', {
          data: JSON.stringify({
            type: 'regular',
            id: 'mockid',
          }),
        });
        assert.notCalled(socket.acknowledge);
      });
    });

    describe('#acknowledge', () => {
      it('requires an event', () => assert.isRejected(socket.acknowledge(), /`event` is required/));

      it('acknowledges async events using event_ack and eventId', () =>
        socket
          .acknowledge({
            data: {
              eventId: 'event-123',
              trackingId: 'tracking-123',
            },
          })
          .then(() => {
            assert.calledWith(
              mockWebSocket.send,
              JSON.stringify({
                type: MESSAGE_TYPES.EVENT_ACK,
                trackingId: 'tracking-123',
                eventId: 'event-123',
              })
            );
          }));
    });
  });
});
