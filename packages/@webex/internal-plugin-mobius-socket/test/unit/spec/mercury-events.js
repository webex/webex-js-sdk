/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import MobiusSocket, {config as mobiusConfig, Socket} from '../../../src';
import sinon from 'sinon';
import MockWebex from '@webex/test-helper-mock-webex';
import MockWebSocket from '@webex/test-helper-mock-web-socket';
import uuid from 'uuid';
import FakeTimers from '@sinonjs/fake-timers';
import {wrap} from 'lodash';

import promiseTick from '../lib/promise-tick';

describe('plugin-mobiusSocket', () => {
  describe('MobiusSocket', () => {
    describe('Events', () => {
      let clock, mobiusSocket, mockWebSocket, socketOpenStub, webex;

      const fakeTestMessage = {
        id: uuid.v4(),
        data: {
          eventType: 'fake.test',
        },
        timestamp: Date.now(),
        trackingId: `suffix_${uuid.v4()}_${Date.now()}`,
      };

      const statusStartTypingMessage = {
        id: uuid.v4(),
        data: {
          eventType: 'status.start_typing',
          actor: {
            id: 'actorId',
          },
          conversationId: uuid.v4(),
        },
        timestamp: Date.now(),
        trackingId: `suffix_${uuid.v4()}_${Date.now()}`,
        sessionId: 'mobius-websocket-session',
      };

      beforeEach(() => {
        clock = FakeTimers.install({now: Date.now()});
      });

      afterEach(async () => {
        clock.uninstall();
        // Clean up mobiusSocket socket and mockWebSocket
        if (mobiusSocket && mobiusSocket.socket) {
          try {
            await mobiusSocket.socket.close();
          } catch (e) {}
        }
        if (mockWebSocket && typeof mockWebSocket.close === 'function') {
          mockWebSocket.close();
        }
        // Restore stubs
        if (Socket.getWebSocketConstructor.restore) {
          Socket.getWebSocketConstructor.restore();
        }
        if (socketOpenStub && socketOpenStub.restore) {
          socketOpenStub.restore();
        }
      });

      beforeEach(() => {
        webex = new MockWebex({
          children: {
            mobiusSocket: MobiusSocket,
          },
        });

        webex.internal.device.registered = true;
        webex.internal.metrics.submitClientMetrics = sinon.stub();
        webex.trackingId = 'fakeTrackingId';
        webex.config.mobiussocket = mobiusConfig.mobiusSocket;

        webex.logger = console;

        mockWebSocket = new MockWebSocket('ws://example.com');
        sinon.stub(Socket, 'getWebSocketConstructor').returns(() => mockWebSocket);

        const origOpen = Socket.prototype.open;

        socketOpenStub = sinon.stub(Socket.prototype, 'open').callsFake(function (...args) {
          const promise = Reflect.apply(origOpen, this, args);

          process.nextTick(() => {
            mockWebSocket.open();
            // Simulate Mobius auth.response after socket open
            process.nextTick(() => {
              mockWebSocket.emit('message', {
                data: JSON.stringify({
                  type: 'auth.response',
                  status: {code: 200},
                }),
              });
            });
          });

          return promise;
        });

        mobiusSocket = webex.internal.mobiusSocket;
        mobiusSocket.defaultSessionId = 'mobius-websocket-session';
      });

      afterEach(() => {
        if (socketOpenStub) {
          socketOpenStub.restore();
        }

        if (Socket.getWebSocketConstructor.restore) {
          Socket.getWebSocketConstructor.restore();
        }
      });

      describe('when connected', () => {
        it('emits the `online` event', () => {
          const spy = sinon.spy();

          mobiusSocket.on('online', spy);
          const promise = mobiusSocket.connect();

          mockWebSocket.open();

          return promise.then(() => assert.called(spy));
        });
      });

      describe('when disconnected', () => {
        it('emits the `offline` event', () => {
          const spy = sinon.spy();

          mobiusSocket.on('offline', spy);
          const promise = mobiusSocket.connect();

          mockWebSocket.open();

          return promise
            .then(() => {
              const promise = mobiusSocket.disconnect();

              mockWebSocket.emit('close', {
                code: 1000,
                reason: 'Done',
              });

              return promise;
            })
            .then(() => assert.calledOnce(spy));
        });

        describe('when reconnected', () => {
          it('emits the `online` event', () => {
            const spy = sinon.spy();

            mobiusSocket.on('online', spy);

            const promise = mobiusSocket.connect();

            mockWebSocket.open();

            return promise
              .then(() => assert.calledOnce(spy))
              .then(() => mockWebSocket.emit('close', {code: 1000, reason: 'Idle'}))
              .then(() => mobiusSocket.connect())
              .then(() => assert.calledTwice(spy));
          });
        });
      });

      describe('when `mercury.buffer_state` is received', () => {
        // This test is here because the buffer states message may arrive before
        // the mobiusSocket Promise resolves.
        it('gets emitted', (done) => {
          const spy = mockWebSocket.send;

          assert.notCalled(spy);
          const bufferStateSpy = sinon.spy();
          const onlineSpy = sinon.spy();

          mobiusSocket.on('event:mercury.buffer_state', bufferStateSpy);
          mobiusSocket.on('online', onlineSpy);

          Socket.getWebSocketConstructor.returns(() => {
            process.nextTick(() => {
              assert.isTrue(mobiusSocket.connecting, 'MobiusSocket is still connecting');
              assert.isFalse(mobiusSocket.connected, 'MobiusSocket has not yet connected');
              assert.notCalled(onlineSpy);
              assert.lengthOf(spy.args, 0, 'The client has not yet sent the auth message');
              // set websocket readystate to 1 to allow a successful send message
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
              // using lengthOf because notCalled doesn't allow the helpful
              // string assertion
              assert.lengthOf(spy.args, 0, 'The client has not acked the buffer_state message');

              promiseTick(1)
                .then(() => {
                  assert.calledOnce(bufferStateSpy);

                  return mobiusSocket.connect().then(done);
                })
                .catch(done);
            });

            return mockWebSocket;
          });

          // Delay send for a tick to ensure the buffer message comes before
          // auth completes.
          mockWebSocket.send = wrap(mockWebSocket.send, function (fn, ...args) {
            process.nextTick(() => {
              Reflect.apply(fn, this, args);
            });
          });
          mobiusSocket.connect();
          assert.lengthOf(spy.args, 0);
        });
      });

      describe('when a CloseEvent is received', () => {
        const events = [
          {
            code: 1000,
            reason: 'idle',
            action: 'reconnect',
          },
          {
            code: 1000,
            reason: 'done (forced)',
            action: 'reconnect',
          },
          {
            code: 1000,
            reason: 'pong not received',
            action: 'close',
          },
          {
            code: 1000,
            reason: 'pong mismatch',
            action: 'close',
          },
          {
            code: 1000,
            action: 'close',
          },
          {
            code: 1003,
            action: 'close',
          },
          {
            code: 1001,
            action: 'reconnect',
          },
          {
            code: 1005,
            action: 'reconnect',
          },
          {
            code: 1006,
            action: 'reconnect',
          },
          {
            code: 1011,
            action: 'reconnect',
          },
          {
            code: 4000,
            action: 'replace',
          },
          {
            action: 'close',
          },
        ];

        events.forEach((def) => {
          const {action, reason, code} = def;
          let description;

          if (code && reason) {
            description = `with code \`${code}\` and reason \`${reason}\``;
          } else if (code) {
            description = `with code \`${code}\``;
          } else if (reason) {
            description = `with reason \`${reason}\``;
          }

          describe(`when an event ${description} is received`, () => {
            it(`takes the ${action} action`, () => {
              if (mobiusSocket._reconnect.restore) {
                mobiusSocket._reconnect.restore();
              }

              sinon.spy(mobiusSocket, 'connect');

              const offlineSpy = sinon.spy();
              const permanentSpy = sinon.spy();
              const transientSpy = sinon.spy();
              const replacedSpy = sinon.spy();

              mobiusSocket.on('offline', offlineSpy);
              mobiusSocket.on('offline.permanent', permanentSpy);
              mobiusSocket.on('offline.transient', transientSpy);
              mobiusSocket.on('offline.replaced', replacedSpy);

              const promise = mobiusSocket.connect();

              mockWebSocket.open();

              return promise
                .then(() => {
                  // Make sure mobiusSocket.connect has a call count of zero
                  mobiusSocket.connect.resetHistory();

                  mockWebSocket.emit('close', {code, reason});

                  return promiseTick(1);
                })
                .then(() => {
                  assert.called(offlineSpy);
                  assert.calledWith(offlineSpy, {code, reason, sessionId: 'mobius-websocket-session'});
                  switch (action) {
                    case 'close':
                      assert.called(permanentSpy);
                      assert.notCalled(transientSpy);
                      assert.notCalled(replacedSpy);
                      break;
                    case 'reconnect':
                      assert.notCalled(permanentSpy);
                      assert.called(transientSpy);
                      assert.notCalled(replacedSpy);
                      break;
                    case 'replace':
                      assert.notCalled(permanentSpy);
                      assert.notCalled(transientSpy);
                      assert.called(replacedSpy);
                      break;
                    default:
                      assert(false, 'unreachable code reached');
                  }
                  assert.isFalse(mobiusSocket.connected, 'MobiusSocket is not connected');
                  if (action === 'reconnect') {
                    assert.called(mobiusSocket.connect);
                    assert.calledWith(mobiusSocket.connect, mockWebSocket.url);
                    assert.isTrue(mobiusSocket.connecting, 'MobiusSocket is connecting');

                    // Block until reconnect completes so logs don't overlap
                    return mobiusSocket.connect();
                  }

                  assert.notCalled(mobiusSocket.connect);
                  assert.isFalse(mobiusSocket.connecting, 'MobiusSocket is not connecting');

                  return Promise.resolve();
                });
            });
          });
        });
      });

      describe('when a MessageEvent is received', () => {
        it('processes the Event via any autowired event handlers', () => {
          webex.fake = {
            processTestEvent: sinon.spy(),
          };

          const promise = mobiusSocket.connect();

          mockWebSocket.open();

          return promise
            .then(() => {
              mockWebSocket.emit('message', {data: JSON.stringify(fakeTestMessage)});

              return promiseTick(1);
            })
            .then(() => {
              assert.called(webex.fake.processTestEvent);
            });
        });

        it('emits the MobiusSocket envelope', () => {
          const startSpy = sinon.spy();
          const stopSpy = sinon.spy();

          mobiusSocket.on('event:status.start_typing', startSpy);
          mobiusSocket.on('event:status.stop_typing', stopSpy);

          const promise = mobiusSocket.connect();

          mockWebSocket.open();

          return promise
            .then(() => {
              mockWebSocket.emit('message', {data: JSON.stringify(statusStartTypingMessage)});

              return promiseTick(1);
            })
            .then(() => {
              assert.calledOnce(startSpy);
              assert.notCalled(stopSpy);
              assert.calledWith(startSpy, statusStartTypingMessage);
            });
        });

        it("emits the MobiusSocket envelope named by the MobiusSocket event's eventType", () => {
          const startSpy = sinon.spy();
          const stopSpy = sinon.spy();

          mobiusSocket.on('event:status.start_typing', startSpy);
          mobiusSocket.on('event:status.stop_typing', stopSpy);

          const promise = mobiusSocket.connect();

          mockWebSocket.open();

          return promise
            .then(() => {
              mockWebSocket.emit('message', {data: JSON.stringify(statusStartTypingMessage)});

              return promiseTick(1);
            })
            .then(() => {
              assert.calledOnce(startSpy);
              assert.notCalled(stopSpy);
              assert.calledWith(startSpy, statusStartTypingMessage);
            });
        });
      });

      // Mobius does not use sequence numbers, so sequence-mismatch tests are not applicable
    });
  });

  /*
  // On mobiusSocket:
  online
  offline
  offline.transient
  offline.permanent
  offline.replaced
  event
  event:locus.participant_joined
  mockWebSocket.connection-failed
  mockWebSocket.sequence-mismatch

  // On webex:
  mobiusSocket.online
  mobiusSocket.offline
  mobiusSocket.offline.transient
  mobiusSocket.offline.permanent
  mobiusSocket.offline.replaced
  mobiusSocket.event
  mobiusSocket.event:locus.participant_joined
  mobiusSocket.mockWebSocket.connection-failed
  mobiusSocket.mockWebSocket.sequence-mismatch

  // TODO go through all it(`emits...`) and make sure corresponding tests are here
  */
});
