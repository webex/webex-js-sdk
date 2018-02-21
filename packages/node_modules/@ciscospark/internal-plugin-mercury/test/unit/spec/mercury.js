/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@ciscospark/test-helper-chai';
import Mercury, {
  BadRequest,
  NotAuthorized,
  Forbidden,
  UnknownResponse,
  // NotFound,
  config as mercuryConfig,
  ConnectionError,
  Socket
} from '@ciscospark/internal-plugin-mercury';
import sinon from '@ciscospark/test-helper-sinon';
import MockSpark from '@ciscospark/test-helper-mock-spark';
import MockWebSocket from '@ciscospark/test-helper-mock-web-socket';
import uuid from 'uuid';
import promiseTick from '../lib/promise-tick';
import lolex from 'lolex';
import {skipInBrowser} from '@ciscospark/test-helper-mocha';

describe('plugin-mercury', () => {
  describe('Mercury', () => {
    let clock,
      mercury,
      mockWebSocket,
      socketOpenStub,
      spark;

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
      clock = lolex.install({now: Date.now()});
    });

    afterEach(() => {
      clock.uninstall();
    });

    beforeEach(() => {
      spark = new MockSpark({
        children: {
          mercury: Mercury
        }
      });
      spark.credentials = {
        refresh: sinon.stub().returns(Promise.resolve()),
        getUserToken: sinon.stub().returns(Promise.resolve({
          toString() {
            return 'Bearer FAKE';
          }
        }))
      };
      spark.internal.device = {
        register: sinon.stub().returns(Promise.resolve()),
        refresh: sinon.stub().returns(Promise.resolve()),
        markUrlFailedAndGetNew: sinon.stub().returns(Promise.resolve()),
        webSocketUrl: 'ws://example.com',
        getWebSocketUrl: sinon.stub().returns(Promise.resolve('ws://example-2.com')),
        useServiceCatalogUrl: sinon.stub().returns(Promise.resolve('https://service-catalog-url.com'))
      };
      spark.internal.metrics.submitClientMetrics = sinon.stub();
      spark.trackingId = 'fakeTrackingId';
      spark.config.mercury = mercuryConfig.mercury;

      spark.logger = console;

      mockWebSocket = new MockWebSocket();
      sinon.stub(Socket, 'getWebSocketConstructor').returns(() => mockWebSocket);

      const origOpen = Socket.prototype.open;
      socketOpenStub = sinon.stub(Socket.prototype, 'open').callsFake(function (...args) {
        const promise = Reflect.apply(origOpen, this, args);
        process.nextTick(() => mockWebSocket.open());
        return promise;
      });

      mercury = spark.internal.mercury;
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
        spark.internal.device.registered = false;
        assert.notCalled(spark.internal.device.register);
        const promise = mercury.connect();
        mockWebSocket.open();
        return promise
          .then(() => {
            assert.calledOnce(spark.internal.device.register);
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
            assert.notCalled(spark.credentials.refresh);
            assert.notCalled(spark.internal.device.refresh);
            const promise = mercury.connect();
            return promiseTick(7)
              .then(() => {
                assert.notCalled(spark.credentials.refresh);
                assert.called(spark.internal.device.refresh);
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
            assert.notCalled(spark.credentials.refresh);
            assert.notCalled(spark.internal.device.refresh);
            const promise = mercury.connect();
            return promiseTick(7)
              .then(() => {
                assert.called(spark.credentials.refresh);
                assert.notCalled(spark.internal.device.refresh);
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
        //     assert.notCalled(spark.credentials.refresh);
        //     assert.notCalled(spark.internal.device.refresh);
        //     const promise = mercury.connect();
        //     return promiseTick(6)
        //       .then(() => {
        //         assert.notCalled(spark.credentials.refresh);
        //         assert.called(spark.internal.device.refresh);
        //         clock.tick(1000);
        //         return assert.isFulfilled(promise);
        //       });
        //   });
        // });

        describe('when web-ha-messaging feature is enabled', () => {
          it('marks current socket url as failed and get new one on Connection Error', () => {
            spark.internal.feature.getFeature.returns(Promise.resolve(true));
            socketOpenStub.restore();
            socketOpenStub = sinon.stub(Socket.prototype, 'open').returns(Promise.resolve());
            socketOpenStub.onCall(0).returns(Promise.reject(new ConnectionError({code: 4001})));
            const promise = mercury.connect();
            return promiseTick(7)
              .then(() => {
                assert.calledOnce(spark.internal.metrics.submitClientMetrics);
                assert.calledOnce(spark.internal.device.markUrlFailedAndGetNew);
                assert.notCalled(spark.internal.device.refresh);
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
              clock.tick(6 * spark.internal.mercury.config.backoffTimeReset);
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
            mockWebSocket.emit('message', {data: statusStartTypingMessage});
          })
          .then(() => {
            assert.calledOnce(spy);

            const promise = mercury.disconnect();
            mockWebSocket.emit('message', {data: statusStartTypingMessage});
            mockWebSocket.emit('close', {
              code: 1000,
              reason: 'Done'
            });
            mockWebSocket.emit('message', {data: statusStartTypingMessage});
            return promise;
          })

          .then(() => {
            mockWebSocket.emit('message', {data: statusStartTypingMessage});
            assert.calledOnce(spy);
          });
      });

      describe('when there is a connection attempt inflight', () => {
        it('stops the attempt', () => {
          socketOpenStub.restore();
          socketOpenStub = sinon.stub(Socket.prototype, 'open');
          socketOpenStub.returns(Promise.reject(new ConnectionError()));
          const promise = mercury.connect();
          return promiseTick(1)
            .then(() => clock.tick(spark.internal.mercury.config.backoffTimeReset))
            .then(() => {
              mercury.disconnect();
              return assert.isRejected(promise);
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
        spark.internal.device.webSocketUrl = 'ws://example.com';
      });

      it('uses device default webSocketUrl', () => spark.internal.mercury._prepareUrl()
        .then((wsUrl) => assert.match(wsUrl, /example.com/)));
      it('uses provided webSocketUrl', () => spark.internal.mercury._prepareUrl('ws://provided.com')
        .then((wsUrl) => assert.match(wsUrl, /provided.com/)));
      it('requests text-mode WebSockets', () => spark.internal.mercury._prepareUrl()
        .then((wsUrl) => assert.match(wsUrl, /outboundWireFormat=text/)));

      it('requests the buffer state message', () => spark.internal.mercury._prepareUrl()
        .then((wsUrl) => assert.match(wsUrl, /bufferStates=true/)));


      it('does not add conditional properties', () => spark.internal.mercury._prepareUrl()
        .then((wsUrl) => {
          assert.notMatch(wsUrl, /mercuryRegistrationStatus/);
          assert.notMatch(wsUrl, /mercuryRegistrationStatus/);
          assert.notMatch(wsUrl, /isRegistrationRefreshEnabled/);
          assert.notMatch(wsUrl, /multipleConnections/);
        }));

      describe('when web-ha-messaging is enabled', () => {
        it('uses webSocketUrl provided by device', () => {
          spark.internal.device.useServiceCatalogUrl = sinon.stub().returns(Promise.resolve('ws://example-2.com'));
          spark.internal.feature.getFeature.onCall(0).returns(Promise.resolve(true));
          return spark.internal.mercury._prepareUrl()
            .then((wsUrl) => assert.match(wsUrl, /example-2.com/));
        });
      });

      describe('when \'web-shared-socket\' is enabled', () => {
        beforeEach(() => {
          spark.internal.feature.getFeature.returns(Promise.resolve(true));
        });

        it('requests shared socket support', () => spark.internal.mercury._prepareUrl()
          .then((wsUrl) => assert.match(wsUrl, /isRegistrationRefreshEnabled=true/)));

        it('requests the registration banner', () => spark.internal.mercury._prepareUrl()
          .then((wsUrl) => assert.match(wsUrl, /mercuryRegistrationStatus=true/)));

        it('does not request the buffer state message', () => spark.internal.mercury._prepareUrl()
          .then((wsUrl) => {
            assert.match(wsUrl, /mercuryRegistrationStatus=true/);
            assert.notMatch(wsUrl, /bufferStates/);
          }));
      });

      describe('when using an ephemeral device', () => {
        beforeEach(() => {
          spark.config.device.ephemeral = true;
        });

        it('indicates multiple connections may be coming from this user', () => spark.internal.mercury._prepareUrl()
          .then((wsUrl) => assert.match(wsUrl, /multipleConnections/)));
      });
    });
  });
});
