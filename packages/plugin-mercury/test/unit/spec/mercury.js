/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@ciscospark/test-helper-chai';
import Mercury, {AuthorizationError, config as mercuryConfig, ConnectionError, Socket} from '../..';
import sinon from '@ciscospark/test-helper-sinon';
import MockSpark from '@ciscospark/test-helper-mock-spark';
import MockWebSocket from '../lib/mock-web-socket';
import uuid from 'uuid';
import promiseTick from '../lib/promise-tick';
import lolex from 'lolex';
import {skipInBrowser} from '@ciscospark/test-helper-mocha';

describe(`plugin-mercury`, () => {
  describe(`Mercury`, () => {
    let clock,
      mercury,
      mockWebSocket,
      socketOpenStub,
      spark;

    const statusStartTypingMessage = JSON.stringify({
      id: uuid.v4(),
      data: {
        eventType: `status.start_typing`,
        actor: {
          id: `actorId`
        },
        conversationId: uuid.v4()
      },
      timestamp: Date.now(),
      trackingId: `suffix_${uuid.v4()}_${Date.now()}`
    });

    beforeEach(() => {
      clock = lolex.install(Date.now());
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

      spark.trackingId = `fakeTrackingId`;
      spark.config.mercury = mercuryConfig.mercury;

      spark.logger = console;

      mockWebSocket = new MockWebSocket();
      sinon.stub(Socket, `getWebSocketConstructor`).returns(() => mockWebSocket);

      const origOpen = Socket.prototype.open;
      socketOpenStub = sinon.stub(Socket.prototype, `open`, function(...args) {
        const promise = Reflect.apply(origOpen, this, args);
        process.nextTick(() => mockWebSocket.open());
        return promise;
      });

      mercury = spark.mercury;
    });

    afterEach(() => {
      if (socketOpenStub) {
        socketOpenStub.restore();
      }

      if (Socket.getWebSocketConstructor.restore) {
        Socket.getWebSocketConstructor.restore();
      }
    });

    describe(`#listen()`, () => {
      it(`proxies to #connect()`, () => {
        sinon.stub(mercury, `connect`);
        mercury.listen();
        assert.called(mercury.connect);
      });
    });

    describe(`#stopListening()`, () => {
      it(`proxies to #disconnect()`, () => {
        sinon.stub(mercury, `connect`);
        mercury.listen();
        assert.called(mercury.connect);
      });
    });

    describe(`#connect()`, () => {
      it(`lazily registers the device`, () => {
        spark.device.registered = false;
        assert.notCalled(spark.device.register);
        const promise = mercury.connect();
        mockWebSocket.open();
        return promise
          .then(() => {
            assert.calledOnce(spark.device.register);
          });
      });

      it(`connects to Mercury`, () => {
        const promise = mercury.connect();
        assert.isFalse(mercury.connected, `Mercury is not connected`);
        assert.isTrue(mercury.connecting, `Mercury is connecting`);
        mockWebSocket.open();
        return promise
          .then(() => {
            assert.isTrue(mercury.connected, `Mercury is connected`);
            assert.isFalse(mercury.connecting, `Mercury is not connecting`);
          });
      });

      describe(`when \`maxRetries\` is set`, () => {
        // skipping due to apparent bug with lolex in all browsers but Chrome.
        skipInBrowser(it)(`fails after \`maxRetries\` attempts`, () => {
          mercury.config.maxRetries = 2;
          socketOpenStub.restore();
          socketOpenStub = sinon.stub(Socket.prototype, `open`);
          socketOpenStub.returns(Promise.reject(new ConnectionError()));
          assert.notCalled(Socket.prototype.open);

          const promise = mercury.connect();
          return promiseTick(3)
            .then(() => {
              assert.calledOnce(Socket.prototype.open);
              clock.tick(mercury.config.backoffTimeReset);
              return promiseTick(3);
            })
            .then(() => {
              assert.calledTwice(Socket.prototype.open);
              clock.tick(2 * mercury.config.backoffTimeReset);
              return promiseTick(3);
            })
            .then(() => {
              assert.calledThrice(Socket.prototype.open);
              clock.tick(4 * mercury.config.backoffTimeReset);
              return assert.isRejected(promise);
            })
            .then(() => {
              assert.calledThrice(Socket.prototype.open);
            });
        });
      });

      it(`can safely be called multiple times`, () => {
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

      describe(`when the connection fails`, () => {
        // skipping due to apparent bug with lolex in all browsers but Chrome.
        skipInBrowser(it)(`backs off exponentially`, () => {
          socketOpenStub.restore();
          socketOpenStub = sinon.stub(Socket.prototype, `open`);
          socketOpenStub.returns(Promise.reject(new ConnectionError()));
          // Note: onCall is zero-based
          socketOpenStub.onCall(2).returns(Promise.resolve(new MockWebSocket()));
          assert.notCalled(Socket.prototype.open);

          const promise = mercury.connect();
          return promiseTick(3)
            .then(() => {
              assert.calledOnce(Socket.prototype.open);
              clock.tick(mercury.config.backoffTimeReset);
              return promiseTick(3);
            })
            .then(() => {
              assert.calledTwice(Socket.prototype.open);
              clock.tick(2 * mercury.config.backoffTimeReset);
              return promiseTick(3);
            })
            .then(() => {
              assert.calledThrice(Socket.prototype.open);
              clock.tick(4 * mercury.config.backoffTimeReset);
              return assert.isFulfilled(promise);
            })
            .then(() => {
              assert.calledThrice(Socket.prototype.open);
              clock.tick(8 * mercury.config.backoffTimeReset);
              return promiseTick(3);
            })
            .then(() => {
              assert.calledThrice(Socket.prototype.open);
            });
        });

        describe(`with \`AuthorizationError\``, () => {
          // skipping due to an apparent bug with lolex in all browsers but Chrome.
          skipInBrowser(it)(`refreshes the access token, reregisters the device, and reconnects the WebSocket`, () => {
            socketOpenStub.restore();
            socketOpenStub = sinon.stub(Socket.prototype, `open`);
            socketOpenStub.onCall(0).returns(Promise.reject(new AuthorizationError()));
            assert.notCalled(spark.refresh);
            const promise = mercury.connect();
            return promiseTick(4)
              .then(() => {
                assert.called(spark.refresh);
                clock.tick(1000);
                return promise;
              });
          });
        });
      });

      describe(`when connected`, () => {
        it(`resolves immediately`, () => mercury.connect()
          .then(() => {
            assert.isTrue(mercury.connected, `Mercury is connected`);
            assert.isFalse(mercury.connecting, `Mercury is not connecting`);
            const promise = mercury.connect();
            assert.isTrue(mercury.connected, `Mercury is connected`);
            assert.isFalse(mercury.connecting, `Mercury is not connecting`);
            return assert.isFulfilled(promise);
          }));

          // skipping due to apparent bug with lolex in all browsers but Chrome.
        skipInBrowser(it)(`does not continue attempting to connect`, () => {
          mercury.connect();
          return promiseTick(1)
            .then(() => {
              clock.tick(6 * spark.mercury.config.backoffTimeReset);
              return promiseTick(1);
            })
            .then(() => {
              assert.calledOnce(Socket.prototype.open);
            });
        });
      });
    });

    describe(`#disconnect()`, () => {
      it(`disconnects the WebSocket`, () => mercury.connect()
        .then(() => {
          assert.isTrue(mercury.connected, `Mercury is connected`);
          assert.isFalse(mercury.connecting, `Mercury is not connecting`);
          const promise = mercury.disconnect();
          mockWebSocket.emit(`close`, {
            code: 1000,
            reason: `Done`
          });
          return promise;
        })
        .then(() => {
          assert.isFalse(mercury.connected, `Mercury is not connected`);
          assert.isFalse(mercury.connecting, `Mercury is not connecting`);
          assert.isUndefined(mercury.mockWebSocket, `Mercury does not have a mockWebSocket`);
        }));

      it(`stops emitting message events`, () => {
        const spy = sinon.spy();
        mercury.on(`event:status.start_typing`, spy);

        return mercury.connect()
          .then(() => {
            assert.isTrue(mercury.connected, `Mercury is connected`);
            assert.isFalse(mercury.connecting, `Mercury is not connecting`);

            assert.notCalled(spy);
            mockWebSocket.emit(`message`, {data: statusStartTypingMessage});
          })
          .then(() => {
            assert.calledOnce(spy);

            const promise = mercury.disconnect();
            mockWebSocket.emit(`message`, {data: statusStartTypingMessage});
            mockWebSocket.emit(`close`, {
              code: 1000,
              reason: `Done`
            });
            mockWebSocket.emit(`message`, {data: statusStartTypingMessage});
            return promise;
          })

          .then(() => {
            mockWebSocket.emit(`message`, {data: statusStartTypingMessage});
            assert.calledOnce(spy);
          });
      });

      describe(`when there is a connection attempt inflight`, () => {
        it(`stops the attempt`, () => {
          socketOpenStub.restore();
          socketOpenStub = sinon.stub(Socket.prototype, `open`);
          socketOpenStub.returns(Promise.reject(new ConnectionError()));
          const promise = mercury.connect();
          return promiseTick(1)
            .then(() => clock.tick(spark.mercury.config.backoffTimeReset))
            .then(() => {
              mercury.disconnect();
              return assert.isRejected(promise);
            });
        });
      });
    });

    describe(`#_emit()`, () => {
      it(`emits Error-safe events`, () => {
        mercury.on(`break`, () => {
          throw new Error();
        });

        return assert.isFulfilled(Promise.resolve(mercury._emit(`break`)));
      });
    });

    describe(`#_applyOverrides()`, () => {
      const lastSeenActivityDate = `Some date`;
      const lastReadableActivityDate = `Some other date`;

      it(`merges a single header field with data`, () => {
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

      it(`merges a multiple header fields with data`, () => {
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

      it(`merges headers when Mercury messages arrive`, () => {
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
  });
});
