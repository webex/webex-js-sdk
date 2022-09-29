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
  Socket
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
    let clock,
      mercury,
      mockWebSocket,
      socketOpenStub,
      webex;

    const statusStartTypingMessage = JSON.stringify({
      id: uuid.v4(),
      data: {
        eventType: 'status.start_typing',
        actor: {
          id: 'actorId'
        },
        conversationId: uuid.v4()
      },
      timestamp: Date.now(),
      trackingId: `suffix_${uuid.v4()}_${Date.now()}`
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
          mercury: Mercury
        }
      });
      webex.credentials = {
        refresh: sinon.stub().returns(Promise.resolve()),
        getUserToken: sinon.stub().returns(Promise.resolve({
          toString() {
            return 'Bearer FAKE';
          }
        }))
      };
      webex.internal.device = {
        register: sinon.stub().returns(Promise.resolve()),
        refresh: sinon.stub().returns(Promise.resolve()),
        webSocketUrl: 'ws://example.com',
        getWebSocketUrl: sinon.stub().returns(Promise.resolve('ws://example-2.com')),
        useServiceCatalogUrl: sinon.stub().returns(Promise.resolve('https://service-catalog-url.com'))
      };
      webex.internal.services = {
        convertUrlToPriorityHostUrl: sinon.stub().returns(Promise.resolve('ws://example-2.com')),
        markFailedUrl: sinon.stub().returns(Promise.resolve())
      };
      webex.internal.metrics.submitClientMetrics = sinon.stub();
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
    });

    afterEach(() => {
      if (socketOpenStub) {
        socketOpenStub.restore();
      }

      if (Socket.getWebSocketConstructor.restore) {
        Socket.getWebSocketConstructor.restore();
      }
    });

    describe('#listen()', () => {
      it('proxies to #connect()', () => {
        sinon.stub(mercury, 'connect');
        mercury.listen();
        assert.called(mercury.connect);
      });
    });

    describe('#stopListening()', () => {
      it('proxies to #disconnect()', () => {
        sinon.stub(mercury, 'connect');
        mercury.listen();
        assert.called(mercury.connect);
      });
    });

    describe('#connect()', () => {
      it('lazily registers the device', () => {
        webex.internal.device.registered = false;
        assert.notCalled(webex.internal.device.register);
        const promise = mercury.connect();

        mockWebSocket.open();

        return promise
          .then(() => {
            assert.calledOnce(webex.internal.device.register);
          });
      });

      it('connects to Mercury using default url', () => {
        const promise = mercury.connect();

        assert.isFalse(mercury.connected, 'Mercury is not connected');
        assert.isTrue(mercury.connecting, 'Mercury is connecting');
        mockWebSocket.open();

        return promise
          .then(() => {
            assert.isTrue(mercury.connected, 'Mercury is connected');
            assert.isFalse(mercury.connecting, 'Mercury is not connecting');
            assert.calledWith(socketOpenStub, sinon.match(/ws:\/\/example.com/), sinon.match.any);
          });
      });

      describe('when `maxRetries` is set', () => {
        // skipping due to apparent bug with lolex in all browsers but Chrome.
        skipInBrowser(it)('fails after `maxRetries` attempts', () => {
          mercury.config.maxRetries = 2;
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
        });
      });

      it('can safely be called multiple times', () => {
        const promise = Promise.all([
          mercury.connect(),
          mercury.connect(),
          mercury.connect(),
          mercury.connect()
        ]);

        mockWebSocket.open();

        return promise
          .then(() => {
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
            socketOpenStub = sinon.stub(Socket.prototype, 'open').returns(Promise.reject(new BadRequest({code: 4400})));

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

            return promiseTick(7)
              .then(() => {
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

            return promiseTick(7)
              .then(() => {
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
            socketOpenStub = sinon.stub(Socket.prototype, 'open').returns(Promise.reject(new Forbidden({code: 4403})));

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

            return promiseTick(7)
              .then(() => {
                assert.calledOnce(webex.internal.services.markFailedUrl);
                clock.tick(1000);

                return promise;
              });
          });
        });
      });

      describe('when connected', () => {
        it('resolves immediately', () => mercury.connect()
          .then(() => {
            assert.isTrue(mercury.connected, 'Mercury is connected');
            assert.isFalse(mercury.connecting, 'Mercury is not connecting');
            const promise = mercury.connect();

            assert.isTrue(mercury.connected, 'Mercury is connected');
            assert.isFalse(mercury.connecting, 'Mercury is not connecting');

            return promise;
          }));

        // skipping due to apparent bug with lolex in all browsers but Chrome.
        skipInBrowser(it)('does not continue attempting to connect', () => {
          mercury.connect();

          return promiseTick(2)
            .then(() => {
              clock.tick(6 * webex.internal.mercury.config.backoffTimeReset);

              return promiseTick(2);
            })
            .then(() => {
              assert.calledOnce(Socket.prototype.open);
            });
        });
      });

      describe('when webSocketUrl is provided', () => {
        it('connects to Mercury with provided url', () => {
          const webSocketUrl = 'ws://providedurl.com';
          const promise = mercury.connect(webSocketUrl);

          assert.isFalse(mercury.connected, 'Mercury is not connected');
          assert.isTrue(mercury.connecting, 'Mercury is connecting');
          mockWebSocket.open();

          return promise
            .then(() => {
              assert.isTrue(mercury.connected, 'Mercury is connected');
              assert.isFalse(mercury.connecting, 'Mercury is not connecting');
              assert.calledWith(Socket.prototype.open, sinon.match(/ws:\/\/providedurl.com/), sinon.match.any);
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

        return promise
          .then(() => {
            assert.isTrue(mercury.connected, 'Mercury is connected');
            assert.isFalse(mercury.connecting, 'Mercury is not connecting');
            assert.calledWith(socketOpenStub, sinon.match(/ws:\/\/example.com/), sinon.match.has('agent',
              sinon.match.has('proxy', sinon.match.has('href', testProxyUrl))));
          });
      });

      it('connects to Mercury without proxy agent', () => {
        const promise = mercury.connect();

        assert.isFalse(mercury.connected, 'Mercury is not connected');
        assert.isTrue(mercury.connecting, 'Mercury is connecting');
        mockWebSocket.open();

        return promise
          .then(() => {
            assert.isTrue(mercury.connected, 'Mercury is connected');
            assert.isFalse(mercury.connecting, 'Mercury is not connecting');
            assert.calledWith(socketOpenStub, sinon.match(/ws:\/\/example.com/), sinon.match({agent: undefined}));
          });
      });
    });

    describe('#disconnect()', () => {
      it('disconnects the WebSocket', () => mercury.connect()
        .then(() => {
          assert.isTrue(mercury.connected, 'Mercury is connected');
          assert.isFalse(mercury.connecting, 'Mercury is not connecting');
          const promise = mercury.disconnect();

          mockWebSocket.emit('close', {
            code: 1000,
            reason: 'Done'
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

        return mercury.connect()
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
              reason: 'Done'
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
          return promiseTick(webex.internal.mercury.config.backoffTimeReset)
            .then(() => {
              // By this time backoffCall and mercury socket should be defined by the
              // 'connect' call
              assert.isDefined(mercury.backoffCall, 'Mercury backoffCall is not defined');
              assert.isDefined(mercury.socket, 'Mercury socket is not defined');
              // Calling disconnect will abort the backoffCall, close the socket, and
              // reject the connect
              mercury.disconnect();
              assert.isUndefined(mercury.backoffCall, 'Mercury backoffCall is still defined');
              // The socket will never be unset (which seems bad)
              assert.isDefined(mercury.socket, 'Mercury socket is not defined');

              return assert.isRejected(promise);
            });
        });

        it('stops the attempt when backoffCall is undefined', () => {
          socketOpenStub.restore();
          socketOpenStub = sinon.stub(Socket.prototype, 'open');
          socketOpenStub.returns(Promise.resolve());

          let reason;

          mercury.backoffCall = undefined;
          mercury._attemptConnection('ws://example.com', (_reason) => {
            reason = _reason;
          });

          return promiseTick(webex.internal.mercury.config.backoffTimeReset)
            .then(() => {
              assert.equal(reason.message, 'mercury: prevent socket open when backoffCall no longer defined');
            });
        });
      });
    });

    describe('#_emit()', () => {
      it('emits Error-safe events', () => {
        mercury.on('break', () => {
          throw new Error();
        });

        return Promise.resolve(mercury._emit('break'));
      });
    });

    describe('#_applyOverrides()', () => {
      const lastSeenActivityDate = 'Some date';
      const lastReadableActivityDate = 'Some other date';

      it('merges a single header field with data', () => {
        const envelope = {
          headers: {
            'data.activity.target.lastSeenActivityDate': lastSeenActivityDate
          },
          data: {
            activity: {}
          }
        };

        mercury._applyOverrides(envelope);

        assert.equal(envelope.data.activity.target.lastSeenActivityDate, lastSeenActivityDate);
      });

      it('merges a multiple header fields with data', () => {
        const envelope = {
          headers: {
            'data.activity.target.lastSeenActivityDate': lastSeenActivityDate,
            'data.activity.target.lastReadableActivityDate': lastReadableActivityDate
          },
          data: {
            activity: {}
          }
        };

        mercury._applyOverrides(envelope);

        assert.equal(envelope.data.activity.target.lastSeenActivityDate, lastSeenActivityDate);
        assert.equal(envelope.data.activity.target.lastReadableActivityDate, lastReadableActivityDate);
      });

      it('merges headers when Mercury messages arrive', () => {
        const envelope = {
          headers: {
            'data.activity.target.lastSeenActivityDate': lastSeenActivityDate
          },
          data: {
            activity: {}
          }
        };

        mercury._applyOverrides(envelope);

        assert.equal(envelope.data.activity.target.lastSeenActivityDate, lastSeenActivityDate);
      });
    });

    describe('#_prepareUrl()', () => {
      beforeEach(() => {
        webex.internal.device.webSocketUrl = 'ws://example.com';
      });

      it('uses device default webSocketUrl', () => webex.internal.mercury._prepareUrl()
        .then((wsUrl) => assert.match(wsUrl, /example.com/)));
      it('uses provided webSocketUrl', () => webex.internal.mercury._prepareUrl('ws://provided.com')
        .then((wsUrl) => assert.match(wsUrl, /provided.com/)));
      it('requests text-mode WebSockets', () => webex.internal.mercury._prepareUrl()
        .then((wsUrl) => assert.match(wsUrl, /outboundWireFormat=text/)));

      it('requests the buffer state message', () => webex.internal.mercury._prepareUrl()
        .then((wsUrl) => assert.match(wsUrl, /bufferStates=true/)));


      it('does not add conditional properties', () => webex.internal.mercury._prepareUrl()
        .then((wsUrl) => {
          assert.notMatch(wsUrl, /mercuryRegistrationStatus/);
          assert.notMatch(wsUrl, /mercuryRegistrationStatus/);
          assert.notMatch(wsUrl, /isRegistrationRefreshEnabled/);
          assert.notMatch(wsUrl, /multipleConnections/);
        }));

      describe('when web-high-availability is enabled', () => {
        it('uses webSocketUrl provided by device', () => {
          webex.internal.device.useServiceCatalogUrl = sinon.stub().returns(Promise.resolve('ws://example-2.com'));
          webex.internal.feature.getFeature.onCall(0).returns(Promise.resolve(true));

          return webex.internal.mercury._prepareUrl()
            .then((wsUrl) => assert.match(wsUrl, /example-2.com/));
        });
      });

      describe('when \'web-shared-socket\' is enabled', () => {
        beforeEach(() => {
          webex.internal.feature.getFeature.returns(Promise.resolve(true));
        });

        it('requests shared socket support', () => webex.internal.mercury._prepareUrl()
          .then((wsUrl) => assert.match(wsUrl, /isRegistrationRefreshEnabled=true/)));

        it('requests the registration banner', () => webex.internal.mercury._prepareUrl()
          .then((wsUrl) => assert.match(wsUrl, /mercuryRegistrationStatus=true/)));

        it('does not request the buffer state message', () => webex.internal.mercury._prepareUrl()
          .then((wsUrl) => {
            assert.match(wsUrl, /mercuryRegistrationStatus=true/);
            assert.notMatch(wsUrl, /bufferStates/);
          }));
      });

      describe('when using an ephemeral device', () => {
        beforeEach(() => {
          webex.config.device.ephemeral = true;
        });

        it('indicates multiple connections may be coming from this user', () => webex.internal.mercury._prepareUrl()
          .then((wsUrl) => assert.match(wsUrl, /multipleConnections/)));
      });
    });
  });
});
