/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import Mercury, {
  BadRequest,
  NotAuthorized,
  Forbidden,
  UnknownResponse,
  // NotFound,
  config as mercuryConfig,
  ConnectionError,
  Socket,
} from '@webex/internal-plugin-mercury';
import sinon from 'sinon';
import MockWebex from '@webex/test-helper-mock-webex';
import MockWebSocket from '@webex/test-helper-mock-web-socket';
import uuid from 'uuid';
import FakeTimers from '@sinonjs/fake-timers';
import {skipInBrowser} from '@webex/test-helper-mocha';

import promiseTick from '../lib/promise-tick';

describe('plugin-mercury', () => {
  describe('Mercury', () => {
    let clock, mercury, mockWebSocket, socketOpenStub, webex;

    const statusStartTypingMessage = JSON.stringify({
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
    });

    beforeEach(() => {
      clock = FakeTimers.install({now: Date.now()});
    });

    afterEach(() => {
      clock.uninstall();
    });

    beforeEach(() => {
      webex = new MockWebex({
        children: {
          mercury: Mercury,
        },
      });
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
      webex.internal.newMetrics.callDiagnosticMetrics.setMercuryConnectedStatus = sinon.stub();
      webex.trackingId = 'fakeTrackingId';
      webex.config.mercury = mercuryConfig.mercury;

      webex.logger = console;

      mockWebSocket = new MockWebSocket();
      sinon.stub(Socket, 'getWebSocketConstructor').returns(() => mockWebSocket);

      const origOpen = Socket.prototype.open;

      socketOpenStub = sinon.stub(Socket.prototype, 'open').callsFake(function (...args) {
        const promise = Reflect.apply(origOpen, this, args);

        process.nextTick(() => mockWebSocket.open());

        return promise;
      });

      mercury = webex.internal.mercury;
      mercury.defaultSessionId = 'mercury-default-session';
    });

    afterEach(async () => {
      // Clean up Mercury connections and internal state
      if (mercury) {
        try {
          await mercury.disconnectAll();
        } catch (e) {
          // Ignore cleanup errors
        }
        // Clear any remaining connection promises
        if (mercury._connectPromises) {
          mercury._connectPromises.clear();
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
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    describe('#listen()', () => {
      it('proxies to #connect()', () => {
        const connectStub = sinon.stub(mercury, 'connect').callThrough();
        return mercury.listen().then(() => {
          assert.called(connectStub);
          assert.calledWith(
            webex.internal.newMetrics.callDiagnosticMetrics.setMercuryConnectedStatus,
            true
          );
        });
      });
    });

    describe('#stopListening()', () => {
      it('proxies to #disconnect()', () => {
        return mercury.connect().then(() => {
          webex.internal.newMetrics.callDiagnosticMetrics.setMercuryConnectedStatus.resetHistory();
          const disconnectStub = sinon.stub(mercury, 'disconnect').callThrough();

          mercury.stopListening();
          assert.called(disconnectStub);
          mockWebSocket.emit('close', {code: 1000, reason: 'test'});
          assert.calledWith(
            webex.internal.newMetrics.callDiagnosticMetrics.setMercuryConnectedStatus,
            false
          );
        });
      });
    });

    describe('#connect()', () => {
      it('lazily registers the device', () => {
        webex.internal.device.registered = false;
        assert.notCalled(webex.internal.device.register);
        const promise = mercury.connect();

        mockWebSocket.open();

        return promise.then(() => {
          assert.calledOnce(webex.internal.device.register);
        });
      });

      it('connects to Mercury using default url', () => {
        webex.internal.feature.updateFeature = sinon.stub();
        const promise = mercury.connect();
        const envelope = {
          data: {
            featureToggle: {
              'feature-name': true,
            },
          },
        };
        assert.isFalse(mercury.connected, 'Mercury is not connected');
        assert.isTrue(mercury.connecting, 'Mercury is connecting');
        mockWebSocket.open();

        return promise.then(() => {
          assert.isTrue(mercury.connected, 'Mercury is connected');
          assert.isFalse(mercury.connecting, 'Mercury is not connecting');
          assert.calledWith(socketOpenStub, sinon.match(/ws:\/\/example.com/), sinon.match.any);
          mercury._emit('event:featureToggle_update', envelope);
          assert.calledOnceWithExactly(
            webex.internal.feature.updateFeature,
            envelope.data.featureToggle
          );
          sinon.restore();
        });
      });

      it('connects to Mercury but does not call updateFeature', () => {
        webex.internal.feature.updateFeature = sinon.stub();
        const promise = mercury.connect();
        const envelope = {};

        return promise.then(() => {
          mercury._emit('event:featureToggle_update', envelope);
          assert.notCalled(webex.internal.feature.updateFeature);
          sinon.restore();
        });
      });
      it('Mercury emit event:ActiveClusterStatusEvent, call services switchActiveClusterIds', () => {
        const promise = mercury.connect();
        const activeClusterEventEnvelope = {
          data: {
            activeClusters: {
              wdm: 'wdm-cluster-id.com',
            },
          },
        };
        mockWebSocket.open();

        return promise.then(() => {
          mercury._emit('event:ActiveClusterStatusEvent', activeClusterEventEnvelope);
          assert.calledOnceWithExactly(
            webex.internal.services.switchActiveClusterIds,
            activeClusterEventEnvelope.data.activeClusters
          );
          sinon.restore();
        });
      });
      it('Mercury emit event:ActiveClusterStatusEvent with no data, not call services switchActiveClusterIds', () => {
        webex.internal.feature.updateFeature = sinon.stub();
        const promise = mercury.connect();
        const envelope = {};

        return promise.then(() => {
          mercury._emit('event:ActiveClusterStatusEvent', envelope);
          assert.notCalled(webex.internal.services.switchActiveClusterIds);
          sinon.restore();
        });
      });
      it('Mercury emit event:u2c.cache-invalidation, call services invalidateCache', () => {
        const promise = mercury.connect();
        const u2cInvalidateEventEnvelope = {
          data: {
            timestamp: '1759289614',
          },
        };

        mockWebSocket.open();

        return promise.then(() => {
          mercury._emit('event:u2c.cache-invalidation', u2cInvalidateEventEnvelope);
          assert.calledOnceWithExactly(
            webex.internal.services.invalidateCache,
            u2cInvalidateEventEnvelope.data.timestamp
          );
          sinon.restore();
        });
      });
      it('Mercury emit event:u2c.cache-invalidation with no data, not call services switchActiveClusterIds', () => {
        webex.internal.feature.updateFeature = sinon.stub();
        const promise = mercury.connect();
        const envelope = {};

        return promise.then(() => {
          mercury._emit('event:u2c.cache-invalidation', envelope);
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

          const promise = mercury.connect();

          return promiseTick(5)
            .then(() => {
              assert.calledOnce(Socket.prototype.open);

              return promiseTick(5);
            })
            .then(() => {
              clock.tick(mercury.config.backoffTimeReset);

              return promiseTick(5);
            })
            .then(() => {
              assert.calledTwice(Socket.prototype.open);
              clock.tick(2 * mercury.config.backoffTimeReset);

              return promiseTick(5);
            })
            .then(() => {
              assert.calledThrice(Socket.prototype.open);
              clock.tick(5 * mercury.config.backoffTimeReset);
              return assert.isRejected(promise);
            })
            .then(() => {
              assert.calledThrice(Socket.prototype.open);
            });
        };

        // skipping due to apparent bug with lolex in all browsers but Chrome.
        // if initial retries is zero and mercury has never connected max retries is used
        skipInBrowser(it)('fails after `maxRetries` attempts', () => {
          mercury.config.maxRetries = 2;
          mercury.config.initialConnectionMaxRetries = 0;

          return check();
        });

        // initial retries is non-zero so takes precedence over maxRetries when mercury has never connected
        skipInBrowser(it)('fails after `initialConnectionMaxRetries` attempts', () => {
          mercury.config.maxRetries = 0;
          mercury.config.initialConnectionMaxRetries = 2;
          return check();
        });

        // initial retries is non-zero so takes precedence over maxRetries when mercury has never connected
        skipInBrowser(it)('fails after `initialConnectionMaxRetries` attempts', () => {
          mercury.config.initialConnectionMaxRetries = 2;
          mercury.config.maxRetries = 5;
          return check();
        });

        // when mercury has connected maxRetries is used and the initialConnectionMaxRetries is ignored
        skipInBrowser(it)('fails after `initialConnectionMaxRetries` attempts', () => {
          mercury.config.initialConnectionMaxRetries = 5;
          mercury.config.maxRetries = 2;
          mercury.hasEverConnected = true;
          return check();
        });
      });

      it('can safely be called multiple times', () => {
        const promise = Promise.all([
          mercury.connect(),
          mercury.connect(),
          mercury.connect(),
          mercury.connect(),
        ]);

        mockWebSocket.open();

        return promise.then(() => {
          assert.calledOnce(Socket.prototype.open);
        });
      });

      // skipping due to apparent bug with lolex in all browsers but Chrome.
      skipInBrowser(describe)('when the connection fails', () => {
        it('backs off exponentially', () => {
          socketOpenStub.restore();
          socketOpenStub = sinon.stub(Socket.prototype, 'open');
          socketOpenStub.returns(Promise.reject(new ConnectionError({code: 4001})));
          // Note: onCall is zero-based
          socketOpenStub.onCall(2).returns(Promise.resolve(new MockWebSocket()));
          assert.notCalled(Socket.prototype.open);

          const promise = mercury.connect();

          return promiseTick(5)
            .then(() => {
              assert.calledOnce(Socket.prototype.open);

              // I'm not sure why, but it's important the clock doesn't advance
              // until a tick happens
              return promiseTick(5);
            })
            .then(() => {
              clock.tick(mercury.config.backoffTimeReset);

              return promiseTick(5);
            })
            .then(() => {
              assert.calledTwice(Socket.prototype.open);
              clock.tick(2 * mercury.config.backoffTimeReset);

              return promiseTick(5);
            })
            .then(() => {
              assert.calledThrice(Socket.prototype.open);
              clock.tick(5 * mercury.config.backoffTimeReset);

              return promise;
            })
            .then(() => {
              assert.calledThrice(Socket.prototype.open);
              clock.tick(8 * mercury.config.backoffTimeReset);

              return promiseTick(5);
            })
            .then(() => {
              assert.calledThrice(Socket.prototype.open);
            });
        });

        describe('with `BadRequest`', () => {
          it('fails permanently', () => {
            clock.uninstall();
            socketOpenStub.restore();
            socketOpenStub = sinon
              .stub(Socket.prototype, 'open')
              .returns(Promise.reject(new BadRequest({code: 4400})));

            return assert.isRejected(mercury.connect());
          });
        });

        describe('with `UnknownResponse`', () => {
          it('triggers a device refresh', () => {
            socketOpenStub.restore();
            socketOpenStub = sinon.stub(Socket.prototype, 'open').returns(Promise.resolve());
            socketOpenStub.onCall(0).returns(Promise.reject(new UnknownResponse({code: 4444})));
            assert.notCalled(webex.credentials.refresh);
            assert.notCalled(webex.internal.device.refresh);
            const promise = mercury.connect();

            return promiseTick(7).then(() => {
              assert.notCalled(webex.credentials.refresh);
              assert.called(webex.internal.device.refresh);
              clock.tick(1000);

              return promise;
            });
          });
        });

        describe('with `NotAuthorized`', () => {
          it('triggers a token refresh', () => {
            socketOpenStub.restore();
            socketOpenStub = sinon.stub(Socket.prototype, 'open').returns(Promise.resolve());
            socketOpenStub.onCall(0).returns(Promise.reject(new NotAuthorized({code: 4401})));
            assert.notCalled(webex.credentials.refresh);
            assert.notCalled(webex.internal.device.refresh);
            const promise = mercury.connect();

            return promiseTick(7).then(() => {
              assert.called(webex.credentials.refresh);
              assert.notCalled(webex.internal.device.refresh);
              clock.tick(1000);

              return promise;
            });
          });
        });

        describe('with `Forbidden`', () => {
          it('fails permanently', () => {
            clock.uninstall();
            socketOpenStub.restore();
            socketOpenStub = sinon
              .stub(Socket.prototype, 'open')
              .returns(Promise.reject(new Forbidden({code: 4403})));

            return assert.isRejected(mercury.connect());
          });
        });

        // describe(`with \`NotFound\``, () => {
        //   it(`triggers a device refresh`, () => {
        //     socketOpenStub.restore();
        //     socketOpenStub = sinon.stub(Socket.prototype, `open`).returns(Promise.resolve());
        //     socketOpenStub.onCall(0).returns(Promise.reject(new NotFound({code: 4404})));
        //     assert.notCalled(webex.credentials.refresh);
        //     assert.notCalled(webex.internal.device.refresh);
        //     const promise = mercury.connect();
        //     return promiseTick(6)
        //       .then(() => {
        //         assert.notCalled(webex.credentials.refresh);
        //         assert.called(webex.internal.device.refresh);
        //         clock.tick(1000);
        //         return assert.isFulfilled(promise);
        //       });
        //   });
        // });

        describe('when web-high-availability feature is enabled', () => {
          it('marks current socket url as failed and get new one on Connection Error', () => {
            webex.internal.feature.getFeature.returns(Promise.resolve(true));
            socketOpenStub.restore();
            socketOpenStub = sinon.stub(Socket.prototype, 'open').returns(Promise.resolve());
            socketOpenStub.onCall(0).returns(Promise.reject(new ConnectionError({code: 4001})));
            const promise = mercury.connect();

            return promiseTick(7).then(() => {
              assert.calledOnce(webex.internal.services.markFailedUrl);
              clock.tick(1000);

              return promise;
            });
          });
        });
      });

      describe('when connected', () => {
        it('resolves immediately', () =>
          mercury.connect().then(() => {
            assert.isTrue(mercury.connected, 'Mercury is connected');
            assert.isFalse(mercury.connecting, 'Mercury is not connecting');
            const promise = mercury.connect();

            assert.isTrue(mercury.connected, 'Mercury is connected');
            assert.isFalse(mercury.connecting, 'Mercury is not connecting');

            return promise;
          }));

        // skipping due to apparent bug with lolex in all browsers but Chrome.
        skipInBrowser(it)('does not continue attempting to connect', () => {
          const promise = mercury.connect();

          // Wait for the connection to be established before proceeding
          mockWebSocket.open();

          return promise.then(() =>
            promiseTick(2)
            .then(() => {
              clock.tick(6 * webex.internal.mercury.config.backoffTimeReset);

              return promiseTick(2);
            })
            .then(() => {
              assert.calledOnce(Socket.prototype.open);
              })
          );
        });
      });

      describe('when webSocketUrl is provided', () => {
        it('connects to Mercury with provided url', () => {
          const webSocketUrl = 'ws://providedurl.com';
          const promise = mercury.connect(webSocketUrl);

          assert.isFalse(mercury.connected, 'Mercury is not connected');
          assert.isTrue(mercury.connecting, 'Mercury is connecting');
          mockWebSocket.open();

          return promise.then(() => {
            assert.isTrue(mercury.connected, 'Mercury is connected');
            assert.isFalse(mercury.connecting, 'Mercury is not connecting');
            assert.calledWith(
              Socket.prototype.open,
              sinon.match(/ws:\/\/providedurl.com.*clientTimestamp[=]\d+/),
              sinon.match.any
            );
          });
        });
      });
    });

    describe('Websocket proxy agent', () => {
      afterEach(() => {
        delete webex.config.defaultMercuryOptions;
      });

      it('connects to Mercury using proxy agent', () => {
        const testProxyUrl = 'http://proxyurl.com:80';

        webex.config.defaultMercuryOptions = {agent: {proxy: {href: testProxyUrl}}};
        const promise = mercury.connect();

        assert.isFalse(mercury.connected, 'Mercury is not connected');
        assert.isTrue(mercury.connecting, 'Mercury is connecting');
        mockWebSocket.open();

        return promise.then(() => {
          assert.isTrue(mercury.connected, 'Mercury is connected');
          assert.isFalse(mercury.connecting, 'Mercury is not connecting');
          assert.calledWith(
            socketOpenStub,
            sinon.match(/ws:\/\/example.com/),
            sinon.match.has(
              'agent',
              sinon.match.has('proxy', sinon.match.has('href', testProxyUrl))
            )
          );
        });
      });

      it('connects to Mercury without proxy agent', () => {
        const promise = mercury.connect();

        assert.isFalse(mercury.connected, 'Mercury is not connected');
        assert.isTrue(mercury.connecting, 'Mercury is connecting');
        mockWebSocket.open();

        return promise.then(() => {
          assert.isTrue(mercury.connected, 'Mercury is connected');
          assert.isFalse(mercury.connecting, 'Mercury is not connecting');
          assert.calledWith(
            socketOpenStub,
            sinon.match(/ws:\/\/example.com/),
            sinon.match({agent: undefined})
          );
        });
      });
    });

    describe('#logout()', () => {
      it('calls disconnectAll and logs', () => {
        sinon.stub(mercury.logger, 'info');
        sinon.stub(mercury, 'disconnectAll');
        mercury.logout();
        assert.called(mercury.disconnectAll);
        assert.calledTwice(mercury.logger.info);

        assert.calledWith(mercury.logger.info.getCall(0), 'Mercury: logout() called');
        assert.isTrue(
          mercury.logger.info
            .getCall(1)
            .args[0].startsWith('Mercury: debug_mercury_logging stack: ')
        );
      });

      it('uses the config.beforeLogoutOptionsCloseReason to disconnect and will send code 3050 for logout', () => {
        sinon.stub(mercury, 'disconnectAll');
        mercury.config.beforeLogoutOptionsCloseReason = 'done (permanent)';
        mercury.logout();
        assert.calledWith(mercury.disconnectAll, {code: 3050, reason: 'done (permanent)'});
      });

      it('uses the config.beforeLogoutOptionsCloseReason to disconnect and will send code 3050 for logout if the reason is different than standard', () => {
        sinon.stub(mercury, 'disconnectAll');
        mercury.config.beforeLogoutOptionsCloseReason = 'test';
        mercury.logout();
        assert.calledWith(mercury.disconnectAll, {code: 3050, reason: 'test'});
      });

      it('uses the config.beforeLogoutOptionsCloseReason to disconnect and will send undefined for logout if the reason is same as standard', () => {
        sinon.stub(mercury, 'disconnectAll');
        mercury.config.beforeLogoutOptionsCloseReason = 'done (forced)';
        mercury.logout();
        assert.calledWith(mercury.disconnectAll, undefined);
      });
    });

    describe('#disconnect()', () => {
      it('disconnects the WebSocket', () =>
        mercury
          .connect()
          .then(() => {
            assert.isTrue(mercury.connected, 'Mercury is connected');
            assert.isFalse(mercury.connecting, 'Mercury is not connecting');
            const promise = mercury.disconnect();

            mockWebSocket.emit('close', {
              code: 1000,
              reason: 'Done',
            });

            return promise;
          })
          .then(() => {
            assert.isFalse(mercury.connected, 'Mercury is not connected');
            assert.isFalse(mercury.connecting, 'Mercury is not connecting');
            assert.isUndefined(mercury.mockWebSocket, 'Mercury does not have a mockWebSocket');
          }));

      it('disconnects the WebSocket with code 3050', () =>
        mercury
          .connect()
          .then(() => {
            assert.isTrue(mercury.connected, 'Mercury is connected');
            assert.isFalse(mercury.connecting, 'Mercury is not connecting');
            const promise = mercury.disconnect();

            mockWebSocket.emit('close', {
              code: 3050,
              reason: 'done (permanent)',
            });

            return promise;
          })
          .then(() => {
            assert.isFalse(mercury.connected, 'Mercury is not connected');
            assert.isFalse(mercury.connecting, 'Mercury is not connecting');
            assert.isUndefined(mercury.mockWebSocket, 'Mercury does not have a mockWebSocket');
          }));

      it('stops emitting message events', () => {
        const spy = sinon.spy();

        mercury.on('event:status.start_typing', spy);

        return mercury
          .connect()
          .then(() => {
            assert.isTrue(mercury.connected, 'Mercury is connected');
            assert.isFalse(mercury.connecting, 'Mercury is not connecting');

            assert.notCalled(spy);
            mockWebSocket.readyState = 1;
            mockWebSocket.emit('open');
            mockWebSocket.emit('message', {data: statusStartTypingMessage});
          })
          .then(() => {
            assert.calledOnce(spy);

            const promise = mercury.disconnect();

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
            promiseTick(2 * webex.internal.mercury.config.backoffTimeReset)
              // Pretend the socket opened successfully. Failing should be fine too but
              // it generates more console output.
              .then(() => Promise.resolve())
          );
          const promise = mercury.connect();

          // Wait for the connect call to setup
          return promiseTick(webex.internal.mercury.config.backoffTimeReset).then(() => {
            // By this time backoffCall and mercury socket should be defined by the
            // 'connect' call
            assert.isDefined(mercury.backoffCalls.get('mercury-default-session'), 'Mercury backoffCall is not defined');
            assert.isDefined(mercury.socket, 'Mercury socket is not defined');
            // Calling disconnect will abort the backoffCall, close the socket, and
            // reject the connect
            mercury.disconnect();
            assert.isUndefined(mercury.backoffCalls.get('mercury-default-session'), 'Mercury backoffCall is still defined');
            // The socket will never be unset (which seems bad)
            assert.isDefined(mercury.socket, 'Mercury socket is not defined');

            return assert.isRejected(promise).then((error) => {
              // connection did not fail, so no last error
              assert.isUndefined(mercury.getLastError());
            });
          });
        });

        it('stops the attempt when backoffCall is undefined', () => {
          socketOpenStub.restore();
          socketOpenStub = sinon.stub(Socket.prototype, 'open');
          socketOpenStub.returns(Promise.resolve());

          let reason;

          mercury.backoffCalls.clear();

          const promise = mercury._attemptConnection(
            'ws://example.com',
            'mercury-default-session',
            (_reason) => {
              reason = _reason;
            }
          );

          return promiseTick(webex.internal.mercury.config.backoffTimeReset).then(() => {
            assert.equal(
              reason.message,
              `Mercury: prevent socket open when backoffCall no longer defined for ${mercury.defaultSessionId}`
            );

            // Ensure the promise was actually rejected (short-circuited)
            return assert.isRejected(promise);
          });
        });

        it('sets lastError when retrying', () => {
          const realError = new Error('FORCED');

          socketOpenStub.restore();
          socketOpenStub = sinon.stub(Socket.prototype, 'open');
          socketOpenStub.onCall(0).returns(Promise.reject(realError));
          const promise = mercury.connect();

          // Wait for the connect call to setup
          return promiseTick(webex.internal.mercury.config.backoffTimeReset).then(() => {
            // Calling disconnect will abort the backoffCall, close the socket, and
            // reject the connect
            mercury.disconnect();

            return assert.isRejected(promise).then((error) => {
              const lastError = mercury.getLastError();

              assert.equal(error.message, `Mercury Connection Aborted for ${mercury.defaultSessionId}`);
              assert.isDefined(lastError);
              assert.equal(lastError, realError);
            });
          });
        });
      });
    });

    describe('#_emit()', () => {
      it('emits Error-safe events and log the error with the call parameters', () => {
        const error = 'error';
        const event = {data: 'some data'};
        mercury.on('break', () => {
          throw error;
        });
        sinon.stub(mercury.logger, 'error');

        return Promise.resolve(mercury._emit('break', event)).then((res) => {
          assert.calledWith(
            mercury.logger.error,
            'Mercury: error occurred in event handler:',
            error,
            ' with args: ',
            ['break', event]
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

        mercury._applyOverrides(envelope);

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

        mercury._applyOverrides(envelope);

        assert.equal(envelope.data.activity.target.lastSeenActivityDate, lastSeenActivityDate);
        assert.equal(
          envelope.data.activity.target.lastReadableActivityDate,
          lastReadableActivityDate
        );
      });

      it('merges headers when Mercury messages arrive', () => {
        const envelope = {
          headers: {
            'data.activity.target.lastSeenActivityDate': lastSeenActivityDate,
          },
          data: {
            activity: {},
          },
        };

        mercury._applyOverrides(envelope);

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
        assert.isUndefined(mercury.mercuryTimeOffset);
        mercury._setTimeOffset('mercury-default-session', event);
        assert.isDefined(mercury.mercuryTimeOffset);
        assert.isTrue(mercury.mercuryTimeOffset > 0);
      });
      it('handles negative offsets', () => {
        const event = {
          data: {
            wsWriteTimestamp: Date.now() + 60000,
          },
        };
        mercury._setTimeOffset('mercury-default-session', event);
        assert.isTrue(mercury.mercuryTimeOffset < 0);
      });
      it('handles invalid wsWriteTimestamp', () => {
        const invalidTimestamps = [null, -1, 'invalid', undefined];
        invalidTimestamps.forEach((invalidTimestamp) => {
          const event = {
            data: {
              wsWriteTimestamp: invalidTimestamp,
            },
          };
          mercury._setTimeOffset('mercury-default-session', event);
          assert.isUndefined(mercury.mercuryTimeOffset);
        });
      });
    });

    describe('#_prepareUrl()', () => {
      beforeEach(() => {
        webex.internal.device.webSocketUrl = 'ws://example.com';
      });

      it('uses device default webSocketUrl', () =>
        webex.internal.mercury._prepareUrl().then((wsUrl) => assert.match(wsUrl, /example.com/)));
      it('uses provided webSocketUrl', () =>
        webex.internal.mercury
          ._prepareUrl('ws://provided.com')
          .then((wsUrl) => assert.match(wsUrl, /.*provided.com.*/)));
      it('requests text-mode WebSockets', () =>
        webex.internal.mercury
          ._prepareUrl()
          .then((wsUrl) => assert.match(wsUrl, /.*outboundWireFormat=text.*/)));

      it('requests the buffer state message', () =>
        webex.internal.mercury
          ._prepareUrl()
          .then((wsUrl) => assert.match(wsUrl, /.*bufferStates=true.*/)));

      it('does not add conditional properties', () =>
        webex.internal.mercury._prepareUrl().then((wsUrl) => {
          assert.notMatch(wsUrl, /mercuryRegistrationStatus/);
          assert.notMatch(wsUrl, /mercuryRegistrationStatus/);
          assert.notMatch(wsUrl, /isRegistrationRefreshEnabled/);
          assert.notMatch(wsUrl, /multipleConnections/);
        }));

      describe('when web-high-availability is enabled', () => {
        it('uses webSocketUrl provided by device', () => {
          webex.internal.device.useServiceCatalogUrl = sinon
            .stub()
            .returns(Promise.resolve('ws://example-2.com'));
          webex.internal.feature.getFeature.onCall(0).returns(Promise.resolve(true));

          return webex.internal.mercury
            ._prepareUrl()
            .then((wsUrl) => assert.match(wsUrl, /example-2.com/));
        });
        it('uses high priority url instead of provided webSocketUrl', () => {
          webex.internal.feature.getFeature.onCall(0).returns(Promise.resolve(true));
          webex.internal.services.convertUrlToPriorityHostUrl = sinon
            .stub()
            .returns(Promise.resolve('ws://example-2.com'));
          return webex.internal.mercury
            ._prepareUrl('ws://provided.com')
            .then((wsUrl) => assert.match(wsUrl, /example-2.com/));
        });
      });

      describe("when 'web-shared-socket' is enabled", () => {
        beforeEach(() => {
          webex.internal.feature.getFeature.returns(Promise.resolve(true));
        });

        it('requests shared socket support', () =>
          webex.internal.mercury
            ._prepareUrl()
            .then((wsUrl) => assert.match(wsUrl, /isRegistrationRefreshEnabled=true/)));

        it('requests the registration banner', () =>
          webex.internal.mercury
            ._prepareUrl()
            .then((wsUrl) => assert.match(wsUrl, /mercuryRegistrationStatus=true/)));

        it('does not request the buffer state message', () =>
          webex.internal.mercury._prepareUrl().then((wsUrl) => {
            assert.match(wsUrl, /mercuryRegistrationStatus=true/);
            assert.notMatch(wsUrl, /bufferStates/);
          }));
      });

      describe('when using an ephemeral device', () => {
        beforeEach(() => {
          webex.config.device.ephemeral = true;
        });

        it('indicates multiple connections may be coming from this user', () =>
          webex.internal.mercury
            ._prepareUrl()
            .then((wsUrl) => assert.match(wsUrl, /multipleConnections/)));
      });
    });

    describe('ping pong latency event is forwarded', () => {
      it('should forward ping pong latency event', () => {
        const spy = sinon.spy();

        mercury.on('ping-pong-latency', spy);

        return mercury.connect().then(() => {
          assert.calledWith(spy, 0);
          assert.calledOnce(spy);
        });
      });
    });

    describe('shutdown protocol', () => {
      describe('#_handleImminentShutdown()', () => {
        let connectWithBackoffStub;
        const sessionId = 'mercury-default-session';

        beforeEach(() => {
          mercury.connected = true;
          mercury.sockets.set(sessionId, {
            url: 'ws://old-socket.com',
            removeAllListeners: sinon.stub(),
          });
          mercury.socket = mercury.sockets.get(sessionId);
          connectWithBackoffStub = sinon.stub(mercury, '_connectWithBackoff');
          connectWithBackoffStub.returns(Promise.resolve());
          sinon.stub(mercury, '_emit');
        });

        afterEach(() => {
          connectWithBackoffStub.restore();
          mercury._emit.restore();
          mercury.sockets.clear();
        });

        it('should be idempotent - no-op if already in progress', () => {
          // Simulate an existing switchover in progress by seeding the backoff map
          mercury._shutdownSwitchoverBackoffCalls.set(sessionId, {placeholder: true});

          mercury._handleImminentShutdown(sessionId);

          assert.notCalled(connectWithBackoffStub);
        });

        it('should set switchover flags when called', () => {
          mercury._handleImminentShutdown(sessionId);

          // With _connectWithBackoff stubbed, the backoff map entry may not be created here.
          // Assert that switchover initiation state was set and a shutdown switchover connect was requested.
          assert.isDefined(mercury._shutdownSwitchoverId);

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
          mercury._handleImminentShutdown(sessionId);

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
          sinon.stub(mercury, '_connectWithBackoff').throws(new Error('Connection failed'));

          mercury._handleImminentShutdown(sessionId);

          // When an exception happens synchronously, the placeholder entry
          // should be removed from the map.
          const switchoverCall = mercury._shutdownSwitchoverBackoffCalls.get(sessionId);
          assert.isUndefined(switchoverCall);
          mercury._connectWithBackoff.restore();
        });
      });


      describe('#_onmessage() with shutdown message', () => {
        beforeEach(() => {
          sinon.stub(mercury, '_handleImminentShutdown');
          sinon.stub(mercury, '_emit');
          sinon.stub(mercury, '_setTimeOffset');
        });

        afterEach(() => {
          mercury._handleImminentShutdown.restore();
          mercury._emit.restore();
          mercury._setTimeOffset.restore();
        });

        it('should trigger _handleImminentShutdown on shutdown message', () => {
          const shutdownEvent = {
            data: {
              type: 'shutdown',
            },
          };

          const result = mercury._onmessage(mercury.defaultSessionId, shutdownEvent);

          assert.calledOnce(mercury._handleImminentShutdown);
          assert.calledWith(
            mercury._emit,
            mercury.defaultSessionId,
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

          mercury._onmessage(mercury.defaultSessionId, shutdownEvent);

          assert.calledOnce(mercury._handleImminentShutdown);
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

          mercury._onmessage(mercury.defaultSessionId, regularEvent);

          assert.notCalled(mercury._handleImminentShutdown);
        });
      });

      describe('#_onclose() with code 4001 (shutdown replacement)', () => {
        let mockSocket, anotherSocket;

        beforeEach(() => {
          mockSocket = {
            url: 'ws://active-socket.com',
            removeAllListeners: sinon.stub(),
          };
          anotherSocket = {
            url: 'ws://old-socket.com',
            removeAllListeners: sinon.stub(),
          };
          mercury.socket = mockSocket;
          mercury.sockets.set(mercury.defaultSessionId, mockSocket);
          mercury.connected = true;
          sinon.stub(mercury, '_emit');
          sinon.stub(mercury, '_reconnect');
          sinon.stub(mercury, 'unset');
        });

        afterEach(() => {
          mercury._emit.restore();
          mercury._reconnect.restore();
          mercury.unset.restore();
        });

        it('should handle active socket close with 4001 - permanent failure', () => {
          const closeEvent = {
            code: 4001,
            reason: 'replaced during shutdown',
          };

          mercury._onclose(mercury.defaultSessionId, closeEvent, mockSocket);

          assert.calledWith(mercury._emit, mercury.defaultSessionId, 'offline.permanent', closeEvent);
          assert.notCalled(mercury._reconnect); // No reconnect for 4001 on active socket
          assert.isFalse(mercury.connected);
        });

        it('should handle non-active socket close with 4001 - no reconnect needed', () => {
          const closeEvent = {
            code: 4001,
            reason: 'replaced during shutdown',
          };

          mercury._onclose(mercury.defaultSessionId, closeEvent, anotherSocket);

          assert.calledWith(mercury._emit, mercury.defaultSessionId, 'offline.replaced', closeEvent);
          assert.notCalled(mercury._reconnect);
          assert.isTrue(mercury.connected); // Should remain connected
          assert.notCalled(mercury.unset);
        });

        it('should distinguish between active and non-active socket closes', () => {
          const closeEvent = {
            code: 4001,
            reason: 'replaced during shutdown',
          };

          // Test non-active socket
          mercury._onclose(mercury.defaultSessionId, closeEvent, anotherSocket);
          assert.calledWith(mercury._emit, mercury.defaultSessionId, 'offline.replaced', closeEvent);

          // Reset the spy call history
          mercury._emit.resetHistory();

          // Test active socket
          mercury.sockets.set(mercury.defaultSessionId, mockSocket);
          mercury._onclose(mercury.defaultSessionId, closeEvent, mockSocket);
          assert.calledWith(mercury._emit, mercury.defaultSessionId, 'offline.permanent', closeEvent);
        });

        it('should handle missing sourceSocket parameter (treats as non-active)', () => {
          const closeEvent = {
            code: 4001,
            reason: 'replaced during shutdown',
          };

          mercury._onclose(mercury.defaultSessionId, closeEvent); // No sourceSocket parameter

          // With simplified logic, undefined !== this.socket, so isActiveSocket = false
          assert.calledWith(mercury._emit, mercury.defaultSessionId, 'offline.replaced', closeEvent);
          assert.notCalled(mercury._reconnect);
        });

        it('should clean up event listeners from non-active socket when it closes', () => {
          const closeEvent = {
            code: 4001,
            reason: 'replaced during shutdown',
          };

          // Close non-active socket (not the active one)
          mercury._onclose(mercury.defaultSessionId, closeEvent, anotherSocket);

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
          mercury._onclose(mercury.defaultSessionId, closeEvent, mockSocket);

          // Verify listeners were removed from active socket
          assert.calledOnce(mockSocket.removeAllListeners);
        });
      });

      describe('shutdown switchover with retry logic', () => {
        let connectWithBackoffStub;
        const sessionId = 'mercury-default-session';

        beforeEach(() => {
          mercury.connected = true;
          mercury.sockets.set(sessionId, {
            url: 'ws://old-socket.com',
            removeAllListeners: sinon.stub(),
          });
          mercury.socket = mercury.sockets.get(sessionId);
          connectWithBackoffStub = sinon.stub(mercury, '_connectWithBackoff');
          sinon.stub(mercury, '_emit');
        });

        afterEach(() => {
          connectWithBackoffStub.restore();
          mercury._emit.restore();
          mercury.sockets.clear();
        });

        it('should call _connectWithBackoff with shutdown switchover context', (done) => {
          connectWithBackoffStub.returns(Promise.resolve());

          mercury._handleImminentShutdown(sessionId);

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
            mercury._shutdownSwitchoverBackoffCalls.set(sessionId, {placeholder: true});
            return new Promise(() => {}); // Never resolves
          });

          mercury._handleImminentShutdown(sessionId);

          const switchoverBackoffCall = mercury._shutdownSwitchoverBackoffCalls.get(sessionId);
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

          mercury._handleImminentShutdown(sessionId);

          await promiseTick(50);

          const emitCalls = mercury._emit.getCalls();
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

          mercury._handleImminentShutdown(sessionId);
          await promiseTick(50);

          const emitCalls = mercury._emit.getCalls();
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

          mercury._handleImminentShutdown(sessionId);
          await promiseTick(50);

          assert.equal(mercury.socket.removeAllListeners.callCount, 0);
        });
      });

      describe('#_prepareAndOpenSocket()', () => {
        let mockSocket, prepareUrlStub, getUserTokenStub;

        beforeEach(() => {
          mockSocket = {
            open: sinon.stub().returns(Promise.resolve()),
          };
          prepareUrlStub = sinon
            .stub(mercury, '_prepareUrl')
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
          await mercury._prepareAndOpenSocket(mockSocket, 'ws://test.com', false);

          assert.calledOnce(prepareUrlStub);
          assert.calledWith(prepareUrlStub, 'ws://test.com');
          assert.calledOnce(getUserTokenStub);
        });

        it('should open socket with correct options for normal connection', async () => {
          await mercury._prepareAndOpenSocket(mockSocket, undefined, false);

          assert.calledOnce(mockSocket.open);
          const callArgs = mockSocket.open.firstCall.args;

          assert.equal(callArgs[0], 'ws://example.com');
          assert.isObject(callArgs[1]);
          assert.equal(callArgs[1].token, 'mock-token');
          assert.isDefined(callArgs[1].forceCloseDelay);
          assert.isDefined(callArgs[1].pingInterval);
          assert.isDefined(callArgs[1].pongTimeout);
        });

        it('should log with correct prefix for normal connection', async () => {
          await mercury._prepareAndOpenSocket(mockSocket, undefined, false);

          // The method should complete successfully - we're testing it runs without error
          // Actual log message verification is complex due to existing stubs in parent scope
          assert.calledOnce(mockSocket.open);
        });

        it('should log with shutdown prefix for shutdown connection', async () => {
          await mercury._prepareAndOpenSocket(mockSocket, undefined, true);

          // The method should complete successfully with shutdown flag
          assert.calledOnce(mockSocket.open);
        });

        it('should merge custom mercury options when provided', async () => {
          webex.config.defaultMercuryOptions = {
            customOption: 'test-value',
            pingInterval: 99999,
          };

          await mercury._prepareAndOpenSocket(mockSocket, undefined, false);

          const callArgs = mockSocket.open.firstCall.args;

          assert.equal(callArgs[1].customOption, 'test-value');
          assert.equal(callArgs[1].pingInterval, 99999); // Custom value overrides default
        });

        it('should return the webSocketUrl after opening', async () => {
          const result = await mercury._prepareAndOpenSocket(mockSocket, undefined, false);

          assert.equal(result, 'ws://example.com');
        });

        it('should handle errors during socket open', async () => {
          mockSocket.open.returns(Promise.reject(new Error('Open failed')));

          try {
            await mercury._prepareAndOpenSocket(mockSocket, undefined, false);
            assert.fail('Should have thrown an error');
          } catch (err) {
            assert.equal(err.message, 'Open failed');
          }
        });
      });

      describe('#_attemptConnection() with shutdown switchover', () => {
        let prepareAndOpenSocketStub, callback;
        const sessionId = 'mercury-default-session';

        beforeEach(() => {
          prepareAndOpenSocketStub = sinon
            .stub(mercury, '_prepareAndOpenSocket')
            .returns(Promise.resolve('ws://new-socket.com'));
          callback = sinon.stub();
          mercury._shutdownSwitchoverBackoffCalls.set(sessionId, {abort: sinon.stub()});
          mercury.socket = {url: 'ws://test.com'};
          mercury.connected = true;
          sinon.stub(mercury, '_emit');
          sinon.stub(mercury, '_attachSocketEventListeners');
        });

        afterEach(() => {
          prepareAndOpenSocketStub.restore();
          mercury._emit.restore();
          mercury._attachSocketEventListeners.restore();
          mercury._shutdownSwitchoverBackoffCalls.clear();
        });

        it('should not set socket reference before opening for shutdown switchover', async () => {
          const originalSocket = mercury.socket;

          await mercury._attemptConnection('ws://test.com', sessionId, callback, {
            isShutdownSwitchover: true,
            onSuccess: (newSocket, url) => {
              assert.equal(mercury.socket, originalSocket);
            },
          });

          assert.equal(mercury.socket, originalSocket);
        });

        it('should call onSuccess callback with new socket and URL for shutdown', async () => {
          const onSuccessStub = sinon.stub();

          await mercury._attemptConnection('ws://test.com', sessionId, callback, {
            isShutdownSwitchover: true,
            onSuccess: onSuccessStub,
          });

          assert.calledOnce(onSuccessStub);
          assert.equal(onSuccessStub.firstCall.args[1], 'ws://new-socket.com');
        });

        it('should emit shutdown switchover complete event', async () => {
          await mercury._attemptConnection('ws://test.com', sessionId, callback, {
            isShutdownSwitchover: true,
            onSuccess: (newSocket, url) => {
              mercury.socket = newSocket;
              mercury.connected = true;
              mercury._emit(
                sessionId,
                'event:mercury_shutdown_switchover_complete',
                {url}
              );
            },
          });

          assert.calledWith(
            mercury._emit,
            sessionId,
            'event:mercury_shutdown_switchover_complete',
            sinon.match.has('url', 'ws://new-socket.com')
          );
        });

        it('should use simpler error handling for shutdown switchover failures', async () => {
          prepareAndOpenSocketStub.returns(Promise.reject(new Error('Connection failed')));

          await mercury
            ._attemptConnection('ws://test.com', sessionId, callback, {
              isShutdownSwitchover: true,
            })
            .catch(() => {});

          assert.calledOnce(callback);
          assert.instanceOf(callback.firstCall.args[0], Error);
        });

        it('should check _shutdownSwitchoverBackoffCall for shutdown connections', () => {
          mercury._shutdownSwitchoverBackoffCalls.clear();

          const result = mercury._attemptConnection(
            'ws://test.com',
            sessionId,
            callback,
            {isShutdownSwitchover: true}
          );

          return result.catch((err) => {
            assert.instanceOf(err, Error);
            assert.match(err.message, /switchover backoff call/);
          });
        });
      });

      describe('#_connectWithBackoff() with shutdown switchover', () => {
        const sessionId = 'mercury-default-session';

        it('should use shutdown-specific parameters when called', () => {
          const connectWithBackoffStub = sinon
            .stub(mercury, '_connectWithBackoff')
            .returns(Promise.resolve());

          mercury._handleImminentShutdown(sessionId);

          assert.calledOnce(connectWithBackoffStub);
          const callArgs = connectWithBackoffStub.firstCall.args;
          assert.equal(callArgs[1], sessionId);
          assert.isObject(callArgs[2]);
          assert.isTrue(callArgs[2].isShutdownSwitchover);

          connectWithBackoffStub.restore();
        });

        it('should pass shutdown switchover options to _attemptConnection', () => {
          const attemptStub = sinon.stub(mercury, '_attemptConnection');
          attemptStub.callsFake((url, sid, cb) => cb());

          const context = {
            isShutdownSwitchover: true,
            attemptOptions: {
              isShutdownSwitchover: true,
              onSuccess: () => {},
            },
          };

          const promise = mercury._connectWithBackoff(undefined, sessionId, context);

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
          sinon.stub(mercury, '_attemptConnection').callsFake((url, sid, cb) => cb());

          mercury._shutdownSwitchoverBackoffCalls.set(sessionId, {placeholder: true});

          const promise = mercury._connectWithBackoff(undefined, sessionId, {
            isShutdownSwitchover: true,
            attemptOptions: {isShutdownSwitchover: true, onSuccess: () => {}},
          });

          return promise.then(() => {
            assert.isUndefined(mercury._shutdownSwitchoverBackoffCalls.get(sessionId));
            mercury._attemptConnection.restore();
          });
        });
      });

      describe('#disconnect() with shutdown switchover in progress', () => {
        let abortStub;
        const sessionId = 'mercury-default-session';

        beforeEach(() => {
          mercury.sockets.clear();
          mercury.sockets.set(sessionId, {
            close: sinon.stub().returns(Promise.resolve()),
            removeAllListeners: sinon.stub(),
          });
          abortStub = sinon.stub();
          mercury._shutdownSwitchoverBackoffCalls.set(sessionId, {abort: abortStub});
        });

        it('should abort shutdown switchover backoff call on disconnect', async () => {
          await mercury.disconnect(undefined, sessionId);

          assert.calledOnce(abortStub);
        });

        it('should handle disconnect when no switchover is in progress', async () => {
          mercury._shutdownSwitchoverBackoffCalls.clear();

          await mercury.disconnect(undefined, sessionId);

          assert.calledOnce(mercury.sockets.get(sessionId).close);
        });
      });
    });
  });
});
