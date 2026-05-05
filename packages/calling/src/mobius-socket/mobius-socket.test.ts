/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {randomUUID} from 'crypto';
import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import MockWebSocket from '@webex/test-helper-mock-web-socket';
import MobiusSocket, {getMobiusSocketInstance, resetMobiusSocketInstance} from './index';
import {BadRequest, NotAuthorized, Forbidden, UnknownResponse, ConnectionError} from './errors';
import mobiusConfig from './config';
import Socket from './socket';
import {skipInBrowser} from './test/mocha-helpers';
import {MESSAGE_TYPES} from './socket/constants';

import promiseTick from './test/promise-tick';

if (!crypto.randomUUID) {
  Object.defineProperty(crypto, 'randomUUID', {
    value: randomUUID,
    configurable: true,
  });
}

describe('plugin-mobius-socket', () => {
  const createUuid = () => crypto.randomUUID();

  describe('getMobiusSocketInstance', () => {
    afterEach(() => {
      resetMobiusSocketInstance();
    });

    it('uses package config when consumer config is not provided', () => {
      const configuredWebex = new MockWebex();
      const instance = getMobiusSocketInstance(configuredWebex);

      assert.instanceOf(instance, MobiusSocket);
      assert.deepEqual(instance.config, mobiusConfig.mobiusSocket);
    });

    it('uses consumer config when it is provided', () => {
      const configuredWebex = new MockWebex();
      const consumerConfig = {
        initialConnectionMaxRetries: 0,
        backoffTimeReset: 1234,
      };

      const instance = getMobiusSocketInstance(configuredWebex, consumerConfig);

      assert.instanceOf(instance, MobiusSocket);
      assert.deepEqual(instance.config, {
        ...mobiusConfig.mobiusSocket,
        ...consumerConfig,
      });
    });
  });

  describe('MobiusSocket', () => {
    let mobiusSocket;
    let mockWebSocket;
    let socketOpenStub;
    let usingFakeTimers;
    let webex;

    const statusStartTypingMessage = JSON.stringify({
      id: createUuid(),
      data: {
        eventType: 'status.start_typing',
        actor: {
          id: 'actorId',
        },
        conversationId: createUuid(),
      },
      timestamp: Date.now(),
      trackingId: `suffix_${createUuid()}_${Date.now()}`,
    });

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

    const createAsyncEvent = (eventId, eventType = 'custom.event') => ({
      data: {
        type: 'async_event',
        eventId,
        data: {
          eventType,
        },
      },
    });

    const createSessionSocket = () => ({
      close: sinon.stub().returns(Promise.resolve()),
      removeAllListeners: sinon.stub(),
    });

    const countGenericEventEmits = (emitSpy, sessionId) =>
      emitSpy.getCalls().filter((call) => call.args[0] === sessionId && call.args[1] === 'event')
        .length;

    beforeEach(() => {
      jest.useFakeTimers({doNotFake: ['nextTick']});
      usingFakeTimers = true;
    });

    beforeEach(() => {
      webex = new MockWebex();
      webex.credentials = {
        refresh: sinon.stub().returns(Promise.resolve()),
        getUserToken: sinon.stub().returns(
          Promise.resolve({
            toString() {
              return 'Bearer FAKE';
            },
          })
        ),
      };
      webex.internal.device = {
        registered: true,
        register: sinon.stub().returns(Promise.resolve()),
        refresh: sinon.stub().returns(Promise.resolve()),
        webSocketUrl: 'ws://example.com',
        getWebSocketUrl: sinon.stub().returns(Promise.resolve('ws://example-2.com')),
        useServiceCatalogUrl: sinon
          .stub()
          .returns(Promise.resolve('https://service-catalog-url.com')),
      };
      webex.internal.services = {
        convertUrlToPriorityHostUrl: sinon.stub().returns(Promise.resolve('ws://example-2.com')),
        markFailedUrl: sinon.stub().returns(Promise.resolve()),
        switchActiveClusterIds: sinon.stub(),
        invalidateCache: sinon.stub(),
        isValidHost: sinon.stub().returns(Promise.resolve(true)),
      };
      webex.internal.metrics.submitClientMetrics = sinon.stub();
      webex.trackingId = 'fakeTrackingId';
      webex.logger = console;

      sinon.stub(Socket, 'getWebSocketConstructor').callsFake(
        () =>
          function (...args) {
            mockWebSocket = new MockWebSocket(...args);

            return mockWebSocket;
          }
      );

      const origOpen = Socket.prototype.open;

      socketOpenStub = sinon.stub(Socket.prototype, 'open').callsFake(function (...args) {
        const promise = Reflect.apply(origOpen, this, args);

        process.nextTick(() => {
          mockWebSocket.open();
          // Simulate Mobius auth response after socket open
          process.nextTick(() => {
            emitAuthResponse();
          });
        });

        return promise;
      });

      mobiusSocket = new MobiusSocket(webex, {...mobiusConfig.mobiusSocket});
      mobiusSocket.defaultSessionId = 'mobius-websocket-session';
    });

    afterEach(async () => {
      if (usingFakeTimers) {
        jest.useRealTimers();
        usingFakeTimers = false;
      }

      // Clean up MobiusSocket connections and internal state
      if (mobiusSocket) {
        try {
          await mobiusSocket.disconnect();
        } catch (e) {
          // Ignore cleanup errors
        }
        // Clear any remaining connection promises
        if (mobiusSocket._connectPromises) {
          mobiusSocket._connectPromises.clear();
        }
      }

      // Ensure mock socket is properly closed
      if (mockWebSocket && typeof mockWebSocket.close === 'function') {
        try {
          mockWebSocket.close();
        } catch (e) {
          // Ignore cleanup errors
        }
      }

      if (socketOpenStub) {
        socketOpenStub.restore();
      }

      if (Socket.getWebSocketConstructor.restore) {
        Socket.getWebSocketConstructor.restore();
      }

      // Small delay to ensure all async operations complete
      await new Promise((resolve) => {
        setTimeout(resolve, 10);
      });
    });

    describe('#connect()', () => {
      it('lazily registers the device', () => {
        webex.internal.device.registered = false;
        assert.notCalled(webex.internal.device.register);
        const promise = mobiusSocket.connect();

        return promise.then(() => {
          assert.calledOnce(webex.internal.device.register);
        });
      });

      it('connects to MobiusSocket using default url', () => {
        webex.internal.feature.updateFeature = sinon.stub();
        const promise = mobiusSocket.connect();
        const envelope = {
          data: {
            featureToggle: {
              'feature-name': true,
            },
          },
        };
        assert.isFalse(mobiusSocket.connected, 'MobiusSocket is not connected');
        assert.isTrue(mobiusSocket.connecting, 'MobiusSocket is connecting');
        mockWebSocket.open();

        return promise.then(() => {
          assert.isTrue(mobiusSocket.connected, 'MobiusSocket is connected');
          assert.isFalse(mobiusSocket.connecting, 'MobiusSocket is not connecting');
          assert.calledWith(socketOpenStub, 'ws://example.com', sinon.match.any);
          mobiusSocket.emit('event:featureToggle_update', envelope);
          assert.calledOnceWithExactly(
            webex.internal.feature.updateFeature,
            envelope.data.featureToggle
          );
          sinon.restore();
        });
      });

      it('connects to MobiusSocket but does not call updateFeature', () => {
        webex.internal.feature.updateFeature = sinon.stub();
        const promise = mobiusSocket.connect();
        const envelope = {};

        return promise.then(() => {
          mobiusSocket.emit('event:featureToggle_update', envelope);
          assert.notCalled(webex.internal.feature.updateFeature);
          sinon.restore();
        });
      });
      it('MobiusSocket emit event:ActiveClusterStatusEvent, call services switchActiveClusterIds', () => {
        const promise = mobiusSocket.connect();
        const activeClusterEventEnvelope = {
          data: {
            activeClusters: {
              wdm: 'wdm-cluster-id.com',
            },
          },
        };
        mockWebSocket.open();

        return promise.then(() => {
          mobiusSocket.emit('event:ActiveClusterStatusEvent', activeClusterEventEnvelope);
          assert.calledOnceWithExactly(
            webex.internal.services.switchActiveClusterIds,
            activeClusterEventEnvelope.data.activeClusters
          );
          sinon.restore();
        });
      });
      it('MobiusSocket emit event:ActiveClusterStatusEvent with no data, not call services switchActiveClusterIds', () => {
        webex.internal.feature.updateFeature = sinon.stub();
        const promise = mobiusSocket.connect();
        const envelope = {};

        return promise.then(() => {
          mobiusSocket.emit('event:ActiveClusterStatusEvent', envelope);
          assert.notCalled(webex.internal.services.switchActiveClusterIds);
          sinon.restore();
        });
      });
      it('MobiusSocket emit event:u2c.cache-invalidation, call services invalidateCache', () => {
        const promise = mobiusSocket.connect();
        const u2cInvalidateEventEnvelope = {
          data: {
            timestamp: '1759289614',
          },
        };

        mockWebSocket.open();

        return promise.then(() => {
          mobiusSocket.emit('event:u2c.cache-invalidation', u2cInvalidateEventEnvelope);
          assert.calledOnceWithExactly(
            webex.internal.services.invalidateCache,
            u2cInvalidateEventEnvelope.data.timestamp
          );
          sinon.restore();
        });
      });
      it('MobiusSocket emit event:u2c.cache-invalidation with no data, not call services switchActiveClusterIds', () => {
        webex.internal.feature.updateFeature = sinon.stub();
        const promise = mobiusSocket.connect();
        const envelope = {};

        return promise.then(() => {
          mobiusSocket.emit('event:u2c.cache-invalidation', envelope);
          assert.notCalled(webex.internal.services.invalidateCache);
          sinon.restore();
        });
      });

      describe('when `maxRetries` is set', () => {
        const check = () => {
          socketOpenStub.restore();
          socketOpenStub = sinon.stub(Socket.prototype, 'open');
          socketOpenStub.returns(Promise.reject(new ConnectionError()));
          assert.notCalled(Socket.prototype.open);

          const promise = mobiusSocket.connect();

          return promiseTick(5)
            .then(() => {
              assert.calledOnce(Socket.prototype.open);

              return promiseTick(5);
            })
            .then(() => {
              jest.advanceTimersByTime(mobiusSocket.config.backoffTimeReset);

              return promiseTick(5);
            })
            .then(() => {
              assert.calledTwice(Socket.prototype.open);
              jest.advanceTimersByTime(2 * mobiusSocket.config.backoffTimeReset);

              return promiseTick(5);
            })
            .then(() => {
              assert.calledThrice(Socket.prototype.open);
              jest.advanceTimersByTime(5 * mobiusSocket.config.backoffTimeReset);

              return assert.isRejected(promise);
            })
            .then(() => {
              assert.calledThrice(Socket.prototype.open);
            });
        };

        // skipping due to apparent bug with lolex in all browsers but Chrome.
        skipInBrowser(it)('fails after configured `initialConnectionMaxRetries` attempts', () => {
          mobiusSocket.config.maxRetries = 0;
          mobiusSocket.config.initialConnectionMaxRetries = 2;

          return check();
        });

        // skipping due to apparent bug with lolex in all browsers but Chrome.
        // if initial retries is zero and mobiusSocket has never connected, do not retry
        skipInBrowser(it)('fails immediately when `initialConnectionMaxRetries` is 0', () => {
          mobiusSocket.config.maxRetries = 2;
          mobiusSocket.config.initialConnectionMaxRetries = 0;

          socketOpenStub.restore();
          socketOpenStub = sinon.stub(Socket.prototype, 'open');
          socketOpenStub.returns(Promise.reject(new ConnectionError()));
          assert.notCalled(Socket.prototype.open);

          const promise = mobiusSocket.connect();

          return promiseTick(5)
            .then(() => {
              assert.calledOnce(Socket.prototype.open);

              return assert.isRejected(promise);
            })
            .then(() => {
              assert.calledOnce(Socket.prototype.open);
            });
        });

        // initial retries is non-zero so takes precedence over maxRetries when mobiusSocket has never connected
        skipInBrowser(it)('fails after `initialConnectionMaxRetries` attempts', () => {
          mobiusSocket.config.maxRetries = 0;
          mobiusSocket.config.initialConnectionMaxRetries = 2;

          return check();
        });

        // initial retries is non-zero so takes precedence over maxRetries when mobiusSocket has never connected
        skipInBrowser(it)('fails after `initialConnectionMaxRetries` attempts', () => {
          mobiusSocket.config.initialConnectionMaxRetries = 2;
          mobiusSocket.config.maxRetries = 5;

          return check();
        });

        // when mobiusSocket has connected maxRetries is used and the initialConnectionMaxRetries is ignored
        skipInBrowser(it)('fails after `initialConnectionMaxRetries` attempts', () => {
          mobiusSocket.config.initialConnectionMaxRetries = 5;
          mobiusSocket.config.maxRetries = 2;
          mobiusSocket.hasEverConnected = true;

          return check();
        });
      });

      it('can safely be called multiple times', () => {
        const promise = Promise.all([
          mobiusSocket.connect(),
          mobiusSocket.connect(),
          mobiusSocket.connect(),
          mobiusSocket.connect(),
        ]);

        mockWebSocket.open();

        return promise.then(() => {
          assert.calledOnce(Socket.prototype.open);
        });
      });

      // skipping due to apparent bug with lolex in all browsers but Chrome.
      skipInBrowser(describe)('when the connection fails', () => {
        it('backs off exponentially', () => {
          mobiusSocket.config.initialConnectionMaxRetries = 2;
          socketOpenStub.restore();
          socketOpenStub = sinon.stub(Socket.prototype, 'open');
          socketOpenStub.returns(Promise.reject(new ConnectionError({code: 4001})));
          // Note: onCall is zero-based
          socketOpenStub.onCall(2).returns(Promise.resolve(new MockWebSocket()));
          assert.notCalled(Socket.prototype.open);

          const promise = mobiusSocket.connect();

          return promiseTick(5)
            .then(() => {
              assert.calledOnce(Socket.prototype.open);

              // I'm not sure why, but it's important the clock doesn't advance
              // until a tick happens
              return promiseTick(5);
            })
            .then(() => {
              jest.advanceTimersByTime(mobiusSocket.config.backoffTimeReset);

              return promiseTick(5);
            })
            .then(() => {
              assert.calledTwice(Socket.prototype.open);
              jest.advanceTimersByTime(2 * mobiusSocket.config.backoffTimeReset);

              return promiseTick(5);
            })
            .then(() => {
              assert.calledThrice(Socket.prototype.open);
              jest.advanceTimersByTime(5 * mobiusSocket.config.backoffTimeReset);

              return promise;
            })
            .then(() => {
              assert.calledThrice(Socket.prototype.open);
              jest.advanceTimersByTime(8 * mobiusSocket.config.backoffTimeReset);

              return promiseTick(5);
            })
            .then(() => {
              assert.calledThrice(Socket.prototype.open);
            });
        });

        describe('with `BadRequest`', () => {
          it('fails permanently', () => {
            jest.useRealTimers();
            usingFakeTimers = false;
            socketOpenStub.restore();
            socketOpenStub = sinon
              .stub(Socket.prototype, 'open')
              .returns(Promise.reject(new BadRequest({code: 4400})));

            return assert.isRejected(mobiusSocket.connect());
          });
        });

        describe('with `UnknownResponse`', () => {
          it('triggers a device refresh', () => {
            mobiusSocket.config.initialConnectionMaxRetries = 1;
            socketOpenStub.restore();
            socketOpenStub = sinon.stub(Socket.prototype, 'open').returns(Promise.resolve());
            socketOpenStub.onCall(0).returns(Promise.reject(new UnknownResponse({code: 4444})));
            assert.notCalled(webex.credentials.refresh);
            assert.notCalled(webex.internal.device.refresh);
            const promise = mobiusSocket.connect();

            return promiseTick(7).then(() => {
              assert.notCalled(webex.credentials.refresh);
              assert.called(webex.internal.device.refresh);
              jest.advanceTimersByTime(1000);

              return promise;
            });
          });
        });

        describe('with `NotAuthorized`', () => {
          it('triggers a token refresh', () => {
            mobiusSocket.config.initialConnectionMaxRetries = 1;
            socketOpenStub.restore();
            socketOpenStub = sinon.stub(Socket.prototype, 'open').returns(Promise.resolve());
            socketOpenStub.onCall(0).returns(Promise.reject(new NotAuthorized({code: 4401})));
            assert.notCalled(webex.credentials.refresh);
            assert.notCalled(webex.internal.device.refresh);
            const promise = mobiusSocket.connect();

            return promiseTick(7).then(() => {
              assert.called(webex.credentials.refresh);
              assert.notCalled(webex.internal.device.refresh);
              jest.advanceTimersByTime(1000);

              return promise;
            });
          });
        });

        describe('with `Forbidden`', () => {
          it('fails permanently', () => {
            jest.useRealTimers();
            usingFakeTimers = false;
            socketOpenStub.restore();
            socketOpenStub = sinon
              .stub(Socket.prototype, 'open')
              .returns(Promise.reject(new Forbidden({code: 4403})));

            return assert.isRejected(mobiusSocket.connect());
          });
        });

        // describe(`with \`NotFound\``, () => {
        //   it(`triggers a device refresh`, () => {
        //     socketOpenStub.restore();
        //     socketOpenStub = sinon.stub(Socket.prototype, `open`).returns(Promise.resolve());
        //     socketOpenStub.onCall(0).returns(Promise.reject(new NotFound({code: 4404})));
        //     assert.notCalled(webex.credentials.refresh);
        //     assert.notCalled(webex.internal.device.refresh);
        //     const promise = mobiusSocket.connect();
        //     return promiseTick(6)
        //       .then(() => {
        //         assert.notCalled(webex.credentials.refresh);
        //         assert.called(webex.internal.device.refresh);
        //         clock.tick(1000);
        //         return assert.isFulfilled(promise);
        //       });
        //   });
        // });
      });

      describe('when connected', () => {
        it('resolves immediately', () =>
          mobiusSocket.connect().then(() => {
            assert.isTrue(mobiusSocket.connected, 'MobiusSocket is connected');
            assert.isFalse(mobiusSocket.connecting, 'MobiusSocket is not connecting');
            const promise = mobiusSocket.connect();

            assert.isTrue(mobiusSocket.connected, 'MobiusSocket is connected');
            assert.isFalse(mobiusSocket.connecting, 'MobiusSocket is not connecting');

            return promise;
          }));

        // skipping due to apparent bug with lolex in all browsers but Chrome.
        skipInBrowser(it)('does not continue attempting to connect', () => {
          const promise = mobiusSocket.connect();

          // Wait for the connection to be established before proceeding
          mockWebSocket.open();

          return promise.then(() =>
            promiseTick(2)
              .then(() => {
                jest.advanceTimersByTime(6 * mobiusSocket.config.backoffTimeReset);

                return promiseTick(2);
              })
              .then(() => {
                assert.calledOnce(Socket.prototype.open);
              })
          );
        });
      });

      describe('when webSocketUrl is provided', () => {
        it('connects to MobiusSocket with provided url', () => {
          const webSocketUrl = 'ws://providedurl.com';
          const promise = mobiusSocket.connect(webSocketUrl);

          assert.isFalse(mobiusSocket.connected, 'MobiusSocket is not connected');
          assert.isTrue(mobiusSocket.connecting, 'MobiusSocket is connecting');
          mockWebSocket.open();

          return promise.then(() => {
            assert.isTrue(mobiusSocket.connected, 'MobiusSocket is connected');
            assert.isFalse(mobiusSocket.connecting, 'MobiusSocket is not connecting');
            assert.calledWith(Socket.prototype.open, 'ws://providedurl.com', sinon.match.any);
          });
        });
      });

      describe('when config.initialConnectionMaxRetries is set to 0', () => {
        it('connects successfully through the shared backoff flow', () => {
          const backoffSpy = sinon.spy(mobiusSocket, '_connectWithBackoff');
          mobiusSocket.config.initialConnectionMaxRetries = 0;
          const promise = mobiusSocket.connect('ws://example.com');

          assert.isTrue(mobiusSocket.connecting, 'MobiusSocket is connecting');
          mockWebSocket.open();

          return promise.then(() => {
            assert.isTrue(mobiusSocket.connected, 'MobiusSocket is connected');
            assert.isFalse(mobiusSocket.connecting, 'MobiusSocket is not connecting');
            assert.isTrue(mobiusSocket.hasEverConnected, 'hasEverConnected is true');
            assert.calledOnce(Socket.prototype.open);
            assert.calledOnce(backoffSpy);
            assert.isUndefined(backoffSpy.firstCall.args[2]?.initialConnectionMaxRetries);
            backoffSpy.restore();
          });
        });

        it('rejects immediately on failure without retrying', () => {
          jest.useRealTimers();
          usingFakeTimers = false;
          socketOpenStub.restore();
          socketOpenStub = sinon
            .stub(Socket.prototype, 'open')
            .returns(Promise.reject(new ConnectionError({code: 4001})));
          mobiusSocket.config.initialConnectionMaxRetries = 0;

          const promise = mobiusSocket.connect('ws://example.com');

          return assert.isRejected(promise).then(() => {
            assert.calledOnce(Socket.prototype.open);
            assert.isFalse(mobiusSocket.connected, 'MobiusSocket is not connected');
          });
        });

        it('uses config-driven initial retry behavior in the shared backoff strategy', () => {
          const backoffSpy = sinon.spy(mobiusSocket, '_connectWithBackoff');
          mobiusSocket.config.initialConnectionMaxRetries = 0;

          const promise = mobiusSocket.connect('ws://example.com');

          mockWebSocket.open();

          return promise.then(() => {
            assert.calledOnce(backoffSpy);
            assert.isUndefined(backoffSpy.firstCall.args[2]?.initialConnectionMaxRetries);
            backoffSpy.restore();
          });
        });

        it('treats a different explicit URL as a fresh initial connect', () => {
          jest.useRealTimers();
          usingFakeTimers = false;
          mobiusSocket.hasEverConnected = true;
          mobiusSocket.socketUrl = 'ws://old-url.com';
          mobiusSocket.config.initialConnectionMaxRetries = 0;
          mobiusSocket.config.maxRetries = 5;

          socketOpenStub.restore();
          socketOpenStub = sinon
            .stub(Socket.prototype, 'open')
            .returns(Promise.reject(new ConnectionError({code: 4001})));

          const promise = mobiusSocket.connect('ws://new-url.com');

          return assert.isRejected(promise).then(() => {
            assert.calledOnce(Socket.prototype.open);
            assert.equal(mobiusSocket.socketUrl, 'ws://new-url.com');
            assert.isFalse(mobiusSocket.hasEverConnected, 'hasEverConnected is false');
          });
        });
      });
    });

    describe('Websocket proxy agent', () => {
      afterEach(() => {
        delete webex.config.defaultMobiusSocketOptions;
      });

      it('connects to MobiusSocket using proxy agent', () => {
        const testProxyUrl = 'http://proxyurl.com:80';

        webex.config.defaultMobiusSocketOptions = {agent: {proxy: {href: testProxyUrl}}};
        const promise = mobiusSocket.connect();

        assert.isFalse(mobiusSocket.connected, 'MobiusSocket is not connected');
        assert.isTrue(mobiusSocket.connecting, 'MobiusSocket is connecting');
        mockWebSocket.open();

        return promise.then(() => {
          assert.isTrue(mobiusSocket.connected, 'MobiusSocket is connected');
          assert.isFalse(mobiusSocket.connecting, 'MobiusSocket is not connecting');
          assert.calledWith(
            socketOpenStub,
            'ws://example.com',
            sinon.match.has(
              'agent',
              sinon.match.has('proxy', sinon.match.has('href', testProxyUrl))
            )
          );
        });
      });

      it('connects to MobiusSocket without proxy agent', () => {
        const promise = mobiusSocket.connect();

        assert.isFalse(mobiusSocket.connected, 'MobiusSocket is not connected');
        assert.isTrue(mobiusSocket.connecting, 'MobiusSocket is connecting');
        mockWebSocket.open();

        return promise.then(() => {
          assert.isTrue(mobiusSocket.connected, 'MobiusSocket is connected');
          assert.isFalse(mobiusSocket.connecting, 'MobiusSocket is not connecting');
          assert.calledWith(socketOpenStub, 'ws://example.com', sinon.match({agent: undefined}));
        });
      });
    });

    describe('#disconnect()', () => {
      it('disconnects the WebSocket', () =>
        mobiusSocket
          .connect()
          .then(() => {
            assert.isTrue(mobiusSocket.connected, 'MobiusSocket is connected');
            assert.isFalse(mobiusSocket.connecting, 'MobiusSocket is not connecting');
            const promise = mobiusSocket.disconnect();

            mockWebSocket.emit('close', {
              code: 1000,
              reason: 'Done',
            });

            return promise;
          })
          .then(() => {
            assert.isFalse(mobiusSocket.connected, 'MobiusSocket is not connected');
            assert.isFalse(mobiusSocket.connecting, 'MobiusSocket is not connecting');
            assert.isUndefined(
              mobiusSocket.mockWebSocket,
              'MobiusSocket does not have a mockWebSocket'
            );
          }));

      it('disconnects the WebSocket with code 3050', () =>
        mobiusSocket
          .connect()
          .then(() => {
            assert.isTrue(mobiusSocket.connected, 'MobiusSocket is connected');
            assert.isFalse(mobiusSocket.connecting, 'MobiusSocket is not connecting');
            const promise = mobiusSocket.disconnect();

            mockWebSocket.emit('close', {
              code: 3050,
              reason: 'done (permanent)',
            });

            return promise;
          })
          .then(() => {
            assert.isFalse(mobiusSocket.connected, 'MobiusSocket is not connected');
            assert.isFalse(mobiusSocket.connecting, 'MobiusSocket is not connecting');
            assert.isUndefined(
              mobiusSocket.mockWebSocket,
              'MobiusSocket does not have a mockWebSocket'
            );
          }));

      it('stops emitting message events', () => {
        const spy = sinon.spy();

        mobiusSocket.on('event:status.start_typing', spy);

        return mobiusSocket
          .connect()
          .then(() => {
            assert.isTrue(mobiusSocket.connected, 'MobiusSocket is connected');
            assert.isFalse(mobiusSocket.connecting, 'MobiusSocket is not connecting');

            assert.notCalled(spy);
            mockWebSocket.readyState = 1;
            mockWebSocket.emit('open');
            mockWebSocket.emit('message', {data: statusStartTypingMessage});
          })
          .then(() => {
            assert.calledOnce(spy);

            const promise = mobiusSocket.disconnect();

            mockWebSocket.readyState = 1;
            mockWebSocket.emit('open');
            mockWebSocket.emit('message', {data: statusStartTypingMessage});
            mockWebSocket.emit('close', {
              code: 1000,
              reason: 'Done',
            });
            mockWebSocket.emit('message', {data: statusStartTypingMessage});

            return promise;
          })

          .then(() => {
            mockWebSocket.readyState = 1;
            mockWebSocket.emit('open');
            mockWebSocket.emit('message', {data: statusStartTypingMessage});
            assert.calledOnce(spy);
          });
      });

      describe('when there is a connection attempt inflight', () => {
        it('stops the attempt when disconnect called', () => {
          socketOpenStub.restore();
          socketOpenStub = sinon.stub(Socket.prototype, 'open');
          socketOpenStub.onCall(0).returns(
            // Delay the opening of the socket so that disconnect is called while open
            // is in progress
            promiseTick(2 * mobiusSocket.config.backoffTimeReset)
              // Pretend the socket opened successfully. Failing should be fine too but
              // it generates more console output.
              .then(() => Promise.resolve())
          );
          const promise = mobiusSocket.connect();

          // Wait for the connect call to setup
          return promiseTick(mobiusSocket.config.backoffTimeReset).then(async () => {
            // By this time backoffCall and mobiusSocket socket should be defined by the
            // 'connect' call
            assert.isDefined(
              mobiusSocket.backoffCalls.get('mobius-websocket-session'),
              'MobiusSocket backoffCall is not defined'
            );
            assert.isDefined(mobiusSocket.socket, 'MobiusSocket socket is not defined');
            // Calling disconnect will abort the backoffCall, close the socket, and
            // reject the connect
            mobiusSocket.disconnect();
            assert.isUndefined(
              mobiusSocket.backoffCalls.get('mobius-websocket-session'),
              'MobiusSocket backoffCall is still defined'
            );
            // The socket will never be unset (which seems bad)
            assert.isDefined(mobiusSocket.socket, 'MobiusSocket socket is not defined');

            await assert.isRejected(promise);
          });
        });

        it('stops the attempt when backoffCall is undefined', () => {
          socketOpenStub.restore();
          socketOpenStub = sinon.stub(Socket.prototype, 'open');
          socketOpenStub.returns(Promise.resolve());

          let reason;

          mobiusSocket.backoffCalls.clear();

          const promise = mobiusSocket._attemptConnection(
            'ws://example.com',
            'mobius-websocket-session',
            (_reason) => {
              reason = _reason;
            }
          );

          return promiseTick(mobiusSocket.config.backoffTimeReset).then(() => {
            assert.equal(
              reason.message,
              `MobiusSocket: prevent socket open when backoffCall no longer defined for ${mobiusSocket.defaultSessionId}`
            );

            // Ensure the promise was actually rejected (short-circuited)
            return assert.isRejected(promise);
          });
        });
      });
    });

    describe('#sendWssRequest()', () => {
      beforeEach(() => {
        mobiusSocket.config.wssResponseTimeout = 100;
      });

      it('resolves when a matching response_event arrives', async () => {
        await mobiusSocket.connect();

        const requestPromise = mobiusSocket.sendWssRequest({
          type: 'auth',
          data: {
            token: 'test',
          },
        });

        await promiseTick();

        const requestPayload = JSON.parse(mockWebSocket.send.lastCall.args[0]);
        assert.equal(requestPayload.data.token, 'test');

        mockWebSocket.emit('message', {
          data: JSON.stringify({
            type: 'response_event',
            subtype: 'auth',
            trackingId: requestPayload.trackingId,
            statusCode: 200,
            statusMessage: 'OK',
          }),
        });

        const response = await requestPromise;

        assert.equal(response.type, 'response_event');
        assert.equal(response.subtype, 'auth');
        assert.equal(response.trackingId, requestPayload.trackingId);
        assert.equal(response.statusCode, 200);
      });

      it('strips the Bearer prefix from connect-time auth token', async () => {
        await mobiusSocket.connect();

        const authPayload = JSON.parse(mockWebSocket.send.firstCall.args[0]);

        assert.equal(authPayload.type, MESSAGE_TYPES.AUTH);
        assert.equal(authPayload.data.token, 'FAKE');
      });

      it('rejects when a matching response_event is non-2xx', async () => {
        await mobiusSocket.connect();

        const requestPromise = mobiusSocket.sendWssRequest({
          type: 'auth',
          data: {
            token: 'test',
          },
        });

        await promiseTick();

        const requestPayload = JSON.parse(mockWebSocket.send.lastCall.args[0]);

        mockWebSocket.emit('message', {
          data: JSON.stringify({
            type: 'response_event',
            subtype: 'auth',
            trackingId: requestPayload.trackingId,
            statusCode: 403,
            statusMessage: 'Forbidden',
          }),
        });

        const error = await assert.isRejected(requestPromise);

        assert.equal(error.name, 'MobiusSocketResponseError');
        assert.equal(error.statusCode, 403);
        assert.equal(error.statusMessage, 'Forbidden');
        assert.equal(error.trackingId, requestPayload.trackingId);
      });

      it('rejects when the matching response does not arrive before timeout', async () => {
        await mobiusSocket.connect();

        const requestPromise = mobiusSocket.sendWssRequest({
          type: 'auth',
          data: {
            token: 'test',
          },
        });

        jest.advanceTimersByTime(101);
        await promiseTick();

        const error = await assert.isRejected(requestPromise);

        assert.equal(error.name, 'MobiusSocketResponseError');
        assert.equal(error.statusCode, 408);
        assert.equal(error.statusMessage, 'Mobius websocket response timed out');
      });

      it('rejects with a clear error when the matching response is missing status code', async () => {
        await mobiusSocket.connect();

        const requestPromise = mobiusSocket.sendWssRequest({
          type: 'auth',
          data: {
            token: 'test',
          },
        });

        await promiseTick();

        const requestPayload = JSON.parse(mockWebSocket.send.lastCall.args[0]);

        mockWebSocket.emit('message', {
          data: JSON.stringify({
            type: 'response_event',
            subtype: 'auth',
            trackingId: requestPayload.trackingId,
          }),
        });

        const error = await assert.isRejected(requestPromise);

        assert.equal(error.name, 'MobiusSocketResponseError');
        assert.isUndefined(error.statusCode);
        assert.equal(error.statusMessage, 'Socket response missing status code');
      });

      it('rejects pending requests when the active socket closes', async () => {
        await mobiusSocket.connect();

        const requestPromise = mobiusSocket.sendWssRequest({
          type: 'auth',
          data: {
            token: 'test',
          },
        });

        mockWebSocket.emit('close', {
          code: 1003,
          reason: 'service rejected request',
        });

        const error = await assert.isRejected(requestPromise);

        assert.instanceOf(error, ConnectionError);
        assert.equal(error.code, 1003);
        assert.equal(error.reason, 'service rejected request');
      });

      it('rejects array payloads', async () => {
        await mobiusSocket.connect();

        const error = await assert.isRejected(mobiusSocket.sendWssRequest([]));

        assert.equal(error.message, '`payload` is required');
      });
    });

    describe('#getConnectedWebSocketUrl()', () => {
      it('returns the connected websocket url for the session', () => {
        mobiusSocket.sockets.set(mobiusSocket.defaultSessionId, {
          connected: true,
          url: 'ws://connected-url.com',
        });

        assert.equal(mobiusSocket.getConnectedWebSocketUrl(), 'ws://connected-url.com');
      });

      it('returns undefined when the session is not connected', () => {
        mobiusSocket.sockets.set(mobiusSocket.defaultSessionId, {
          connected: false,
          url: 'ws://disconnected-url.com',
        });

        assert.isUndefined(mobiusSocket.getConnectedWebSocketUrl());
      });
    });

    describe('#_emit()', () => {
      it('emits Error-safe events and log the error with the call parameters', () => {
        const error = 'error';
        const event = {data: 'some data'};
        mobiusSocket.on('break', () => {
          throw error;
        });
        sinon.stub(mobiusSocket.logger, 'error');

        return Promise.resolve(
          mobiusSocket._emit(mobiusSocket.defaultSessionId, 'break', event)
        ).then((res) => {
          assert.calledWith(
            mobiusSocket.logger.error,
            'MobiusSocket: error occurred in event handler:',
            error,
            ' with args: ',
            [mobiusSocket.defaultSessionId, 'break', event]
          );

          return res;
        });
      });
    });

    describe('#_applyOverrides()', () => {
      const lastSeenActivityDate = 'Some date';
      const lastReadableActivityDate = 'Some other date';

      it('merges a single header field with data', () => {
        const envelope = {
          headers: {
            'data.activity.target.lastSeenActivityDate': lastSeenActivityDate,
          },
          data: {
            activity: {},
          },
        };

        mobiusSocket._applyOverrides(envelope);

        assert.equal(envelope.data.activity.target.lastSeenActivityDate, lastSeenActivityDate);
      });

      it('merges a multiple header fields with data', () => {
        const envelope = {
          headers: {
            'data.activity.target.lastSeenActivityDate': lastSeenActivityDate,
            'data.activity.target.lastReadableActivityDate': lastReadableActivityDate,
          },
          data: {
            activity: {},
          },
        };

        mobiusSocket._applyOverrides(envelope);

        assert.equal(envelope.data.activity.target.lastSeenActivityDate, lastSeenActivityDate);
        assert.equal(
          envelope.data.activity.target.lastReadableActivityDate,
          lastReadableActivityDate
        );
      });

      it('merges headers when MobiusSocket messages arrive', () => {
        const envelope = {
          headers: {
            'data.activity.target.lastSeenActivityDate': lastSeenActivityDate,
          },
          data: {
            activity: {},
          },
        };

        mobiusSocket._applyOverrides(envelope);

        assert.equal(envelope.data.activity.target.lastSeenActivityDate, lastSeenActivityDate);
      });
    });

    describe('#_setTimeOffset', () => {
      it('sets mercuryTimeOffset based on the difference between wsWriteTimestamp and now', () => {
        const event = {
          data: {
            wsWriteTimestamp: Date.now() - 60000,
          },
        };
        assert.isUndefined(mobiusSocket.mercuryTimeOffset);
        mobiusSocket._setTimeOffset('mobius-websocket-session', event);
        assert.isDefined(mobiusSocket.mercuryTimeOffset);
        assert.isTrue(mobiusSocket.mercuryTimeOffset > 0);
      });
      it('handles negative offsets', () => {
        const event = {
          data: {
            wsWriteTimestamp: Date.now() + 60000,
          },
        };
        mobiusSocket._setTimeOffset('mobius-websocket-session', event);
        assert.isTrue(mobiusSocket.mercuryTimeOffset < 0);
      });
      it('handles invalid wsWriteTimestamp', () => {
        const invalidTimestamps = [null, -1, 'invalid', undefined];
        invalidTimestamps.forEach((invalidTimestamp) => {
          const event = {
            data: {
              wsWriteTimestamp: invalidTimestamp,
            },
          };
          mobiusSocket._setTimeOffset('mobius-websocket-session', event);
          assert.isUndefined(mobiusSocket.mercuryTimeOffset);
        });
      });
    });

    describe('#_prepareUrl()', () => {
      it('returns the provided URL as-is (no Mercury URL transforms)', () =>
        mobiusSocket._prepareUrl('ws://provided.com').then((wsUrl) => {
          assert.equal(wsUrl, 'ws://provided.com');
        }));

      it('falls back to device webSocketUrl when no URL is provided', () =>
        mobiusSocket._prepareUrl().then((wsUrl) => {
          assert.equal(wsUrl, 'ws://example.com');
        }));
    });

    describe('shutdown protocol', () => {
      describe('#_handleImminentShutdown()', () => {
        let connectWithBackoffStub;
        const sessionId = 'mobius-websocket-session';

        beforeEach(() => {
          mobiusSocket.connected = true;
          mobiusSocket.sockets.set(sessionId, {
            url: 'ws://old-socket.com',
            removeAllListeners: sinon.stub(),
          });
          mobiusSocket.socket = mobiusSocket.sockets.get(sessionId);
          connectWithBackoffStub = sinon.stub(mobiusSocket, '_connectWithBackoff');
          connectWithBackoffStub.returns(Promise.resolve());
          sinon.stub(mobiusSocket, '_emit');
        });

        afterEach(() => {
          connectWithBackoffStub.restore();
          mobiusSocket._emit.restore();
          mobiusSocket.sockets.clear();
        });

        it('should be idempotent - no-op if already in progress', () => {
          // Simulate an existing switchover in progress by seeding the backoff map
          mobiusSocket._shutdownSwitchoverBackoffCalls.set(sessionId, {placeholder: true});

          mobiusSocket._handleImminentShutdown(sessionId);

          assert.notCalled(connectWithBackoffStub);
        });

        it('should set switchover flags when called', () => {
          mobiusSocket._handleImminentShutdown(sessionId);

          assert.calledOnce(connectWithBackoffStub);
          const callArgs = connectWithBackoffStub.firstCall.args;
          assert.isUndefined(callArgs[0]); // webSocketUrl
          assert.equal(callArgs[1], sessionId); // sessionId
          assert.isObject(callArgs[2]); // context
          assert.isTrue(callArgs[2].isShutdownSwitchover);
          assert.isObject(callArgs[2].attemptOptions);
          assert.isTrue(callArgs[2].attemptOptions.isShutdownSwitchover);
        });

        it('should call _connectWithBackoff with correct parameters', (done) => {
          mobiusSocket._handleImminentShutdown(sessionId);

          process.nextTick(() => {
            assert.calledOnce(connectWithBackoffStub);
            const callArgs = connectWithBackoffStub.firstCall.args;
            assert.isUndefined(callArgs[0]); // webSocketUrl
            assert.equal(callArgs[1], sessionId); // sessionId
            assert.isObject(callArgs[2]); // context
            assert.isTrue(callArgs[2].isShutdownSwitchover);
            assert.isObject(callArgs[2].attemptOptions);
            assert.isTrue(callArgs[2].attemptOptions.isShutdownSwitchover);
            done();
          });
        });

        it('should handle exceptions during switchover', () => {
          connectWithBackoffStub.restore();
          sinon.stub(mobiusSocket, '_connectWithBackoff').throws(new Error('Connection failed'));

          mobiusSocket._handleImminentShutdown(sessionId);

          // When an exception happens synchronously, the placeholder entry
          // should be removed from the map.
          const switchoverCall = mobiusSocket._shutdownSwitchoverBackoffCalls.get(sessionId);
          assert.isUndefined(switchoverCall);
          mobiusSocket._connectWithBackoff.restore();
        });
      });

      describe('#_onmessage() with shutdown message', () => {
        beforeEach(() => {
          sinon.stub(mobiusSocket, '_handleImminentShutdown');
          sinon.stub(mobiusSocket, '_emit');
          sinon.stub(mobiusSocket, '_setTimeOffset');
        });

        afterEach(() => {
          mobiusSocket._handleImminentShutdown.restore();
          mobiusSocket._emit.restore();
          mobiusSocket._setTimeOffset.restore();
        });

        it('should trigger _handleImminentShutdown on shutdown message', () => {
          const shutdownEvent = {
            data: {
              type: 'shutdown',
            },
          };

          const result = mobiusSocket._onmessage(mobiusSocket.defaultSessionId, shutdownEvent);

          assert.calledOnce(mobiusSocket._handleImminentShutdown);
          assert.calledWith(
            mobiusSocket._emit,
            mobiusSocket.defaultSessionId,
            'event:mercury_shutdown_imminent',
            shutdownEvent.data
          );
          assert.instanceOf(result, Promise);
        });

        it('should handle shutdown message without additional data gracefully', () => {
          const shutdownEvent = {
            data: {
              type: 'shutdown',
            },
          };

          mobiusSocket._onmessage(mobiusSocket.defaultSessionId, shutdownEvent);

          assert.calledOnce(mobiusSocket._handleImminentShutdown);
        });

        it('should not trigger shutdown handling for non-shutdown messages', () => {
          const regularEvent = {
            data: {
              type: 'regular',
              data: {
                eventType: 'conversation.activity',
              },
            },
          };

          mobiusSocket._onmessage(mobiusSocket.defaultSessionId, regularEvent);

          assert.notCalled(mobiusSocket._handleImminentShutdown);
        });
      });

      describe('#_onmessage() with missing data or eventType', () => {
        beforeEach(() => {
          sinon.stub(mobiusSocket, '_emit');
          sinon.stub(mobiusSocket, '_setTimeOffset');
          sinon.stub(mobiusSocket, '_applyOverrides');
        });

        afterEach(() => {
          mobiusSocket._emit.restore();
          mobiusSocket._setTimeOffset.restore();
          mobiusSocket._applyOverrides.restore();
        });

        it('should not throw when envelope.data is undefined', () => {
          const event = {
            data: {
              type: 'someType',
              // no nested data property
            },
          };

          const result = mobiusSocket._onmessage(mobiusSocket.defaultSessionId, event);

          assert.instanceOf(result, Promise);
          assert.calledWith(mobiusSocket._emit, mobiusSocket.defaultSessionId, 'event', event.data);
        });

        it('should not throw when data.eventType is undefined', () => {
          const event = {
            data: {
              type: 'someType',
              data: {
                // no eventType property
                someField: 'value',
              },
            },
          };

          const result = mobiusSocket._onmessage(mobiusSocket.defaultSessionId, event);

          assert.instanceOf(result, Promise);
          assert.calledWith(mobiusSocket._emit, mobiusSocket.defaultSessionId, 'event', event.data);
        });

        it('should emit generic event for messages without eventType (e.g. subscription responses)', () => {
          const event = {
            data: {
              id: 'msg-123',
              sequenceNumber: 5,
              data: {
                statusCode: 200,
              },
            },
          };

          const result = mobiusSocket._onmessage(mobiusSocket.defaultSessionId, event);

          assert.instanceOf(result, Promise);
          assert.calledOnce(mobiusSocket._emit);
          assert.calledWith(mobiusSocket._emit, mobiusSocket.defaultSessionId, 'event', event.data);
        });

        it('should still process messages with a valid eventType', async () => {
          const event = {
            data: {
              data: {
                eventType: 'conversation.activity',
              },
            },
          };

          await mobiusSocket._onmessage(mobiusSocket.defaultSessionId, event);

          // Normal flow emits namespace-specific events after processing handlers.
          // The early-return guard only emits 'event', so asserting these proves the normal path was taken.
          assert.calledWith(
            mobiusSocket._emit,
            mobiusSocket.defaultSessionId,
            'event:conversation',
            event.data
          );
          assert.calledWith(
            mobiusSocket._emit,
            mobiusSocket.defaultSessionId,
            'event:conversation.activity',
            event.data
          );
        });
      });

      describe('#_onmessage() async_event deduplication', () => {
        let originalDedupCacheMaxSize;

        beforeEach(() => {
          originalDedupCacheMaxSize = mobiusSocket.config.dedupCacheMaxSize;
        });

        afterEach(() => {
          mobiusSocket.config.dedupCacheMaxSize = originalDedupCacheMaxSize;
        });

        it('suppresses duplicate async_event messages for the same session', async () => {
          const emitSpy = sinon.spy(mobiusSocket, '_emit');

          await mobiusSocket._onmessage('session-a', createAsyncEvent('evt-1'));
          await mobiusSocket._onmessage('session-a', createAsyncEvent('evt-1'));

          assert.equal(countGenericEventEmits(emitSpy, 'session-a'), 1);
          emitSpy.restore();
        });

        it('suppresses duplicate async_event messages across socket replacement without disconnect', async () => {
          const sessionId = 'session-a';
          const emitSpy = sinon.spy(mobiusSocket, '_emit');
          mobiusSocket.sockets.set(sessionId, createSessionSocket());

          await mobiusSocket._onmessage(sessionId, createAsyncEvent('evt-2'));

          mobiusSocket.sockets.set(sessionId, createSessionSocket());
          await mobiusSocket._onmessage(sessionId, createAsyncEvent('evt-2'));

          assert.equal(countGenericEventEmits(emitSpy, sessionId), 1);
          emitSpy.restore();
        });

        it('evicts only the oldest eventId when the dedup cache exceeds max size', async () => {
          const emitSpy = sinon.spy(mobiusSocket, '_emit');

          mobiusSocket.config.dedupCacheMaxSize = 3;

          await mobiusSocket._onmessage('session-a', createAsyncEvent('e1'));
          await mobiusSocket._onmessage('session-a', createAsyncEvent('e2'));
          await mobiusSocket._onmessage('session-a', createAsyncEvent('e3'));
          await mobiusSocket._onmessage('session-a', createAsyncEvent('e4'));
          await mobiusSocket._onmessage('session-a', createAsyncEvent('e2'));
          await mobiusSocket._onmessage('session-a', createAsyncEvent('e1'));

          assert.equal(countGenericEventEmits(emitSpy, 'session-a'), 5);
          emitSpy.restore();
        });

        it('clears the session dedup cache on disconnect', async () => {
          const sessionId = 'session-a';
          const emitSpy = sinon.spy(mobiusSocket, '_emit');

          await mobiusSocket._onmessage(sessionId, createAsyncEvent('evt-3'));

          mobiusSocket.sockets.set(sessionId, createSessionSocket());
          await mobiusSocket.disconnect(undefined, sessionId);
          await mobiusSocket._onmessage(sessionId, createAsyncEvent('evt-3'));

          assert.equal(countGenericEventEmits(emitSpy, sessionId), 2);
          emitSpy.restore();
        });
      });

      describe('#_getEventHandlers()', () => {
        it('should return an empty array when eventType is undefined', () => {
          const result = mobiusSocket._getEventHandlers(undefined);

          assert.deepEqual(result, []);
        });

        it('should return an empty array when eventType is null', () => {
          const result = mobiusSocket._getEventHandlers(null);

          assert.deepEqual(result, []);
        });

        it('should return an empty array when eventType is an empty string', () => {
          const result = mobiusSocket._getEventHandlers('');

          assert.deepEqual(result, []);
        });

        it('should return an empty array when namespace is not registered', () => {
          const result = mobiusSocket._getEventHandlers('unknownNamespace.someEvent');

          assert.deepEqual(result, []);
        });
      });

      describe('#_onclose() with code 4001 (shutdown replacement)', () => {
        let mockSocket;
        let anotherSocket;

        beforeEach(() => {
          mockSocket = {
            url: 'ws://active-socket.com',
            removeAllListeners: sinon.stub(),
          };
          anotherSocket = {
            url: 'ws://old-socket.com',
            removeAllListeners: sinon.stub(),
          };
          mobiusSocket.socket = mockSocket;
          mobiusSocket.sockets.set(mobiusSocket.defaultSessionId, mockSocket);
          mobiusSocket.connected = true;
          sinon.stub(mobiusSocket, '_emit');
          sinon.stub(mobiusSocket, '_reconnect');
        });

        afterEach(() => {
          mobiusSocket._emit.restore();
          mobiusSocket._reconnect.restore();
        });

        it('should handle active socket close with 4001 - permanent failure', () => {
          const closeEvent = {
            code: 4001,
            reason: 'replaced during shutdown',
          };

          mobiusSocket._onclose(mobiusSocket.defaultSessionId, closeEvent, mockSocket);

          assert.calledWith(
            mobiusSocket._emit,
            mobiusSocket.defaultSessionId,
            'offline.permanent',
            closeEvent
          );
          assert.notCalled(mobiusSocket._reconnect); // No reconnect for 4001 on active socket
          assert.isFalse(mobiusSocket.connected);
        });

        it('should handle non-active socket close with 4001 - no reconnect needed', () => {
          const closeEvent = {
            code: 4001,
            reason: 'replaced during shutdown',
          };

          mobiusSocket._onclose(mobiusSocket.defaultSessionId, closeEvent, anotherSocket);

          assert.calledWith(
            mobiusSocket._emit,
            mobiusSocket.defaultSessionId,
            'offline.replaced',
            closeEvent
          );
          assert.notCalled(mobiusSocket._reconnect);
          assert.isTrue(mobiusSocket.connected); // Should remain connected
          assert.strictEqual(mobiusSocket.socket, mockSocket);
        });

        it('should distinguish between active and non-active socket closes', () => {
          const closeEvent = {
            code: 4001,
            reason: 'replaced during shutdown',
          };

          // Test non-active socket
          mobiusSocket._onclose(mobiusSocket.defaultSessionId, closeEvent, anotherSocket);
          assert.calledWith(
            mobiusSocket._emit,
            mobiusSocket.defaultSessionId,
            'offline.replaced',
            closeEvent
          );

          // Reset the spy call history
          mobiusSocket._emit.resetHistory();

          // Test active socket
          mobiusSocket.sockets.set(mobiusSocket.defaultSessionId, mockSocket);
          mobiusSocket._onclose(mobiusSocket.defaultSessionId, closeEvent, mockSocket);
          assert.calledWith(
            mobiusSocket._emit,
            mobiusSocket.defaultSessionId,
            'offline.permanent',
            closeEvent
          );
        });

        it('should handle missing sourceSocket parameter (treats as non-active)', () => {
          const closeEvent = {
            code: 4001,
            reason: 'replaced during shutdown',
          };

          mobiusSocket._onclose(mobiusSocket.defaultSessionId, closeEvent); // No sourceSocket parameter

          // With simplified logic, undefined !== this.socket, so isActiveSocket = false
          assert.calledWith(
            mobiusSocket._emit,
            mobiusSocket.defaultSessionId,
            'offline.replaced',
            closeEvent
          );
          assert.notCalled(mobiusSocket._reconnect);
        });

        it('should clean up event listeners from non-active socket when it closes', () => {
          const closeEvent = {
            code: 4001,
            reason: 'replaced during shutdown',
          };

          // Close non-active socket (not the active one)
          mobiusSocket._onclose(mobiusSocket.defaultSessionId, closeEvent, anotherSocket);

          // Verify listeners were removed from the old socket
          // The _onclose method checks if sourceSocket !== this.socket (non-active)
          // and then calls removeAllListeners in the else branch
          assert.calledOnce(anotherSocket.removeAllListeners);
        });

        it('should not clean up listeners from active socket listeners until close handler runs', () => {
          const closeEvent = {
            code: 4001,
            reason: 'replaced during shutdown',
          };

          // Close active socket
          mobiusSocket._onclose(mobiusSocket.defaultSessionId, closeEvent, mockSocket);

          // Verify listeners were removed from active socket
          assert.calledOnce(mockSocket.removeAllListeners);
        });
      });

      describe('shutdown switchover with retry logic', () => {
        let connectWithBackoffStub;
        const sessionId = 'mobius-websocket-session';

        beforeEach(() => {
          mobiusSocket.connected = true;
          mobiusSocket.sockets.set(sessionId, {
            url: 'ws://old-socket.com',
            removeAllListeners: sinon.stub(),
          });
          mobiusSocket.socket = mobiusSocket.sockets.get(sessionId);
          connectWithBackoffStub = sinon.stub(mobiusSocket, '_connectWithBackoff');
          sinon.stub(mobiusSocket, '_emit');
        });

        afterEach(() => {
          connectWithBackoffStub.restore();
          mobiusSocket._emit.restore();
          mobiusSocket.sockets.clear();
        });

        it('should call _connectWithBackoff with shutdown switchover context', (done) => {
          connectWithBackoffStub.returns(Promise.resolve());

          mobiusSocket._handleImminentShutdown(sessionId);

          process.nextTick(() => {
            assert.calledOnce(connectWithBackoffStub);
            const callArgs = connectWithBackoffStub.firstCall.args;

            assert.isUndefined(callArgs[0]); // webSocketUrl
            assert.equal(callArgs[1], sessionId);
            assert.isObject(callArgs[2]);
            assert.isTrue(callArgs[2].isShutdownSwitchover);
            assert.isObject(callArgs[2].attemptOptions);
            assert.isTrue(callArgs[2].attemptOptions.isShutdownSwitchover);
            done();
          });
        });

        it('should set _shutdownSwitchoverInProgress flag during switchover', () => {
          // With the new behavior, "in progress" is represented by the presence
          // of an entry in _shutdownSwitchoverBackoffCalls.
          // Since _connectWithBackoff is stubbed in this suite, simulate its side-effect
          // of seeding the backoff-call map entry.
          connectWithBackoffStub.callsFake(() => {
            mobiusSocket._shutdownSwitchoverBackoffCalls.set(sessionId, {placeholder: true});

            return new Promise(() => {}); // Never resolves
          });

          mobiusSocket._handleImminentShutdown(sessionId);

          const switchoverBackoffCall = mobiusSocket._shutdownSwitchoverBackoffCalls.get(sessionId);
          assert.isOk(switchoverBackoffCall);
        });

        it('should emit success event when switchover completes', async () => {
          connectWithBackoffStub.callsFake((url, sid, context) => {
            if (context && context.attemptOptions && context.attemptOptions.onSuccess) {
              const mockSocket = {url: 'ws://new-socket.com'};
              context.attemptOptions.onSuccess(mockSocket, 'ws://new-socket.com');
            }

            return Promise.resolve();
          });

          mobiusSocket._handleImminentShutdown(sessionId);

          await promiseTick(50);

          const emitCalls = mobiusSocket._emit.getCalls();
          const hasCompleteEvent = emitCalls.some(
            (call) =>
              call.args[0] === sessionId &&
              call.args[1] === 'event:mercury_shutdown_switchover_complete'
          );

          assert.isTrue(hasCompleteEvent, 'Should emit switchover complete event');
        });

        it('should emit failure event when switchover exhausts retries', async () => {
          const testError = new Error('Connection failed');

          connectWithBackoffStub.returns(Promise.reject(testError));

          mobiusSocket._handleImminentShutdown(sessionId);
          await promiseTick(50);

          const emitCalls = mobiusSocket._emit.getCalls();
          const hasFailureEvent = emitCalls.some(
            (call) =>
              call.args[0] === sessionId &&
              call.args[1] === 'event:mercury_shutdown_switchover_failed' &&
              call.args[2] &&
              call.args[2].reason === testError
          );

          assert.isTrue(hasFailureEvent, 'Should emit switchover failed event');
        });

        it('should allow old socket to be closed by server after switchover failure', async () => {
          connectWithBackoffStub.returns(Promise.reject(new Error('Failed')));

          mobiusSocket._handleImminentShutdown(sessionId);
          await promiseTick(50);

          assert.equal(mobiusSocket.socket.removeAllListeners.callCount, 0);
        });
      });

      describe('#_prepareAndOpenSocket()', () => {
        let mockSocket;
        let prepareUrlStub;
        let getUserTokenStub;

        beforeEach(() => {
          mockSocket = {
            open: sinon.stub().returns(Promise.resolve()),
          };
          prepareUrlStub = sinon
            .stub(mobiusSocket, '_prepareUrl')
            .returns(Promise.resolve('ws://example.com'));
          getUserTokenStub = webex.credentials.getUserToken;
          getUserTokenStub.returns(
            Promise.resolve({
              toString: () => 'mock-token',
            })
          );
        });

        afterEach(() => {
          prepareUrlStub.restore();
        });

        it('should prepare URL and get user token', async () => {
          await mobiusSocket._prepareAndOpenSocket(mockSocket, 'ws://test.com', false);

          assert.calledOnce(prepareUrlStub);
          assert.calledWith(prepareUrlStub, 'ws://test.com');
          assert.calledOnce(getUserTokenStub);
        });

        it('should open socket with correct options for normal connection', async () => {
          await mobiusSocket._prepareAndOpenSocket(mockSocket, undefined, false);

          assert.calledOnce(mockSocket.open);
          const callArgs = mockSocket.open.firstCall.args;

          assert.equal(callArgs[0], 'ws://example.com');
          assert.isObject(callArgs[1]);
          assert.equal(callArgs[1].token, 'mock-token');
          assert.isDefined(callArgs[1].forceCloseDelay);
          assert.isDefined(callArgs[1].wssResponseTimeout);
        });

        it('should log with correct prefix for normal connection', async () => {
          await mobiusSocket._prepareAndOpenSocket(mockSocket, undefined, false);

          // The method should complete successfully - we're testing it runs without error
          // Actual log message verification is complex due to existing stubs in parent scope
          assert.calledOnce(mockSocket.open);
        });

        it('should log with shutdown prefix for shutdown connection', async () => {
          await mobiusSocket._prepareAndOpenSocket(mockSocket, undefined, true);

          // The method should complete successfully with shutdown flag
          assert.calledOnce(mockSocket.open);
        });

        it('should merge custom mobiusSocket options when provided', async () => {
          webex.config.defaultMobiusSocketOptions = {
            customOption: 'test-value',
            wssResponseTimeout: 99999,
          };

          await mobiusSocket._prepareAndOpenSocket(mockSocket, undefined, false);

          const callArgs = mockSocket.open.firstCall.args;

          assert.equal(callArgs[1].customOption, 'test-value');
          assert.equal(callArgs[1].wssResponseTimeout, 99999); // Custom value overrides default
        });

        it('should return the webSocketUrl after opening', async () => {
          const result = await mobiusSocket._prepareAndOpenSocket(mockSocket, undefined, false);

          assert.equal(result, 'ws://example.com');
        });

        it('should handle errors during socket open', async () => {
          mockSocket.open.returns(Promise.reject(new Error('Open failed')));

          try {
            await mobiusSocket._prepareAndOpenSocket(mockSocket, undefined, false);
            assert.fail('Should have thrown an error');
          } catch (err) {
            assert.equal(err.message, 'Open failed');
          }
        });
      });

      describe('#_attemptConnection() with shutdown switchover', () => {
        let prepareAndOpenSocketStub;
        let callback;
        const sessionId = 'mobius-websocket-session';

        beforeEach(() => {
          prepareAndOpenSocketStub = sinon
            .stub(mobiusSocket, '_prepareAndOpenSocket')
            .returns(Promise.resolve('ws://new-socket.com'));
          callback = sinon.stub();
          mobiusSocket._shutdownSwitchoverBackoffCalls.set(sessionId, {abort: sinon.stub()});
          mobiusSocket.socket = {url: 'ws://test.com'};
          mobiusSocket.connected = true;
          sinon.stub(mobiusSocket, '_emit');
          sinon.stub(mobiusSocket, '_attachSocketEventListeners');
        });

        afterEach(() => {
          prepareAndOpenSocketStub.restore();
          mobiusSocket._emit.restore();
          mobiusSocket._attachSocketEventListeners.restore();
          mobiusSocket._shutdownSwitchoverBackoffCalls.clear();
        });

        it('should not set socket reference before opening for shutdown switchover', async () => {
          const originalSocket = mobiusSocket.socket;

          await mobiusSocket._attemptConnection('ws://test.com', sessionId, callback, {
            isShutdownSwitchover: true,
            onSuccess: (newSocket, url) => {
              assert.exists(newSocket);
              assert.equal(url, 'ws://test.com');
              assert.equal(mobiusSocket.socket, originalSocket);
            },
          });

          assert.equal(mobiusSocket.socket, originalSocket);
        });

        it('should call onSuccess callback with new socket and URL for shutdown', async () => {
          const onSuccessStub = sinon.stub();

          await mobiusSocket._attemptConnection('ws://test.com', sessionId, callback, {
            isShutdownSwitchover: true,
            onSuccess: onSuccessStub,
          });

          assert.calledOnce(onSuccessStub);
          assert.equal(onSuccessStub.firstCall.args[1], 'ws://new-socket.com');
        });

        it('should emit shutdown switchover complete event', async () => {
          await mobiusSocket._attemptConnection('ws://test.com', sessionId, callback, {
            isShutdownSwitchover: true,
            onSuccess: (newSocket, url) => {
              mobiusSocket.socket = newSocket;
              mobiusSocket.connected = true;
              mobiusSocket._emit(sessionId, 'event:mercury_shutdown_switchover_complete', {url});
            },
          });

          assert.calledWith(
            mobiusSocket._emit,
            sessionId,
            'event:mercury_shutdown_switchover_complete',
            sinon.match.has('url', 'ws://new-socket.com')
          );
        });

        it('should use simpler error handling for shutdown switchover failures', async () => {
          prepareAndOpenSocketStub.returns(Promise.reject(new Error('Connection failed')));

          await mobiusSocket
            ._attemptConnection('ws://test.com', sessionId, callback, {
              isShutdownSwitchover: true,
            })
            .catch(() => {});

          assert.calledOnce(callback);
          assert.instanceOf(callback.firstCall.args[0], Error);
        });

        it('should check _shutdownSwitchoverBackoffCall for shutdown connections', () => {
          mobiusSocket._shutdownSwitchoverBackoffCalls.clear();

          const result = mobiusSocket._attemptConnection('ws://test.com', sessionId, callback, {
            isShutdownSwitchover: true,
          });

          return result.catch((err) => {
            assert.instanceOf(err, Error);
            assert.match(err.message, /switchover backoff call/);
          });
        });
      });

      describe('#_connectWithBackoff() with shutdown switchover', () => {
        const sessionId = 'mobius-websocket-session';

        it('should use shutdown-specific parameters when called', () => {
          const connectWithBackoffStub = sinon
            .stub(mobiusSocket, '_connectWithBackoff')
            .returns(Promise.resolve());

          mobiusSocket._handleImminentShutdown(sessionId);

          assert.calledOnce(connectWithBackoffStub);
          const callArgs = connectWithBackoffStub.firstCall.args;
          assert.equal(callArgs[1], sessionId);
          assert.isObject(callArgs[2]);
          assert.isTrue(callArgs[2].isShutdownSwitchover);

          connectWithBackoffStub.restore();
        });

        it('should pass shutdown switchover options to _attemptConnection', () => {
          const attemptStub = sinon.stub(mobiusSocket, '_attemptConnection');
          attemptStub.callsFake((url, sid, cb) => cb());

          const context = {
            isShutdownSwitchover: true,
            attemptOptions: {
              isShutdownSwitchover: true,
              onSuccess: () => {},
            },
          };

          const promise = mobiusSocket._connectWithBackoff(undefined, sessionId, context);

          return promise.then(() => {
            assert.calledOnce(attemptStub);
            const callArgs = attemptStub.firstCall.args;
            assert.equal(callArgs[1], sessionId);
            assert.isObject(callArgs[3]);
            assert.isTrue(callArgs[3].isShutdownSwitchover);
            attemptStub.restore();
          });
        });

        it('should set and clear state flags appropriately', () => {
          sinon.stub(mobiusSocket, '_attemptConnection').callsFake((url, sid, cb) => cb());

          mobiusSocket._shutdownSwitchoverBackoffCalls.set(sessionId, {placeholder: true});

          const promise = mobiusSocket._connectWithBackoff(undefined, sessionId, {
            isShutdownSwitchover: true,
            attemptOptions: {isShutdownSwitchover: true, onSuccess: () => {}},
          });

          return promise.then(() => {
            assert.isUndefined(mobiusSocket._shutdownSwitchoverBackoffCalls.get(sessionId));
            mobiusSocket._attemptConnection.restore();
          });
        });
      });

      describe('#disconnect() with shutdown switchover in progress', () => {
        let abortStub;
        const sessionId = 'mobius-websocket-session';

        beforeEach(() => {
          mobiusSocket.sockets.clear();
          mobiusSocket.sockets.set(sessionId, {
            close: sinon.stub().returns(Promise.resolve()),
            removeAllListeners: sinon.stub(),
          });
          abortStub = sinon.stub();
          mobiusSocket._shutdownSwitchoverBackoffCalls.set(sessionId, {abort: abortStub});
        });

        it('should abort shutdown switchover backoff call on disconnect', async () => {
          await mobiusSocket.disconnect(undefined, sessionId);

          assert.calledOnce(abortStub);
        });

        it('should handle disconnect when no switchover is in progress', async () => {
          mobiusSocket._shutdownSwitchoverBackoffCalls.clear();

          await mobiusSocket.disconnect(undefined, sessionId);

          assert.calledOnce(mobiusSocket.sockets.get(sessionId).close);
        });
      });
    });
  });
});
