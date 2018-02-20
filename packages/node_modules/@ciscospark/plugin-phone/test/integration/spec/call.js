/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import '@ciscospark/plugin-phone';

import {assert} from '@ciscospark/test-helper-chai';
import sinon from '@ciscospark/test-helper-sinon';
import CiscoSpark from '@ciscospark/spark-core';
import testUsers from '@ciscospark/test-helper-test-users';
import {browserOnly, expectEvent, handleErrorEvent} from '@ciscospark/test-helper-mocha';
import {base64} from '@ciscospark/common';

import {
  expectCallCreatedEvent,
  expectCallIncomingEvent,
  expectConnectedEvent,
  expectDisconnectedEvent,
  expectErrorEvent,
  expectRingingEvent
} from '../lib/event-expectations';

browserOnly(describe)('plugin-phone', function () {
  this.timeout(30000);

  describe('Call', () => {
    let mccoy, spock;
    beforeEach('create users and register', () => testUsers.create({count: 2})
      .then((users) => {
        [mccoy, spock] = users;
        spock.spark = new CiscoSpark({
          credentials: {
            authorization: spock.token
          }
        });

        mccoy.spark = new CiscoSpark({
          credentials: {
            authorization: mccoy.token
          }
        });
        return Promise.all([
          spock.spark.phone.register(),
          mccoy.spark.phone.register()
        ]);
      }));

    afterEach('unregister spock and mccoy', () => Promise.all([
      spock && spock.spark.phone.deregister()
        // eslint-disable-next-line no-console
        .catch((reason) => console.warn('could not disconnect spock from mercury', reason)),
      mccoy && mccoy.spark.phone.deregister()
        // eslint-disable-next-line no-console
        .catch((reason) => console.warn('could not disconnect mccoy from mercury', reason))
    ]));

    describe('#id', () => {
      // TODO [SSDK-572] need call id
      it('identifies the local party\'s leg of the call');
    });

    describe('#sessionId', () => {
      // TODO [SSDK-573]
      it('identifies the call');
    });

    describe('#status', () => {
      describe('when a call is dialed, acknowledged, joined, and left', () => {
        it('emits all the correct events', () => {
          let remoteCall;
          const localCallStatusSpy = sinon.spy();
          const remoteCallStatusSpy = sinon.spy();
          const handler = handleErrorEvent(
            spock.spark.phone.dial(mccoy.email),
            (localCall) => {
              localCall.on('change:status', () => localCallStatusSpy(localCall.status));
              assert.equal(localCall.status, 'initiated');
              return expectCallIncomingEvent(mccoy.spark.phone)
                .then((c) => {
                  remoteCall = c;
                  remoteCall.on('change:status', () => remoteCallStatusSpy(remoteCall.status));
                  assert.equal(remoteCall.status, 'initiated');
                  return Promise.all([
                    remoteCall.acknowledge(),
                    expectRingingEvent(localCall)
                  ]);
                })
                .then(() => assert.equal(localCall.status, 'ringing'))
                .then(() => Promise.all([
                  remoteCall.answer(),
                  expectConnectedEvent(localCall),
                  expectConnectedEvent(remoteCall)
                ]))
                .then(() => {
                  assert.equal(localCall.status, 'connected');
                  assert.equal(remoteCall.status, 'connected');
                })
                .then(() => Promise.all([
                  expectDisconnectedEvent(localCall),
                  expectDisconnectedEvent(remoteCall),
                  localCall.hangup()
                ]))
                .then(() => {
                  assert.equal(localCallStatusSpy.args[0][0], 'ringing');
                  assert.equal(localCallStatusSpy.args[1][0], 'connected');
                  assert.equal(localCallStatusSpy.args[2][0], 'disconnected');
                  assert.equal(remoteCallStatusSpy.args[0][0], 'connected');
                  assert.equal(remoteCallStatusSpy.args[1][0], 'disconnected');
                  assert.equal(localCall.status, 'disconnected');
                  assert.equal(remoteCall.status, 'disconnected');
                });
            }
          );
          return handler;
        });
      });

      describe('when the receiving party has declined the call', () => {
        it('is "disconnected"', () => {
          const call = spock.spark.phone.dial(mccoy.email);
          assert.equal(call.status, 'initiated');
          return handleErrorEvent(call, () => Promise.all([
            expectCallIncomingEvent(mccoy.spark.phone)
              .then((c) => c.reject()),
            expectDisconnectedEvent(call)
              .then(() => assert.equal(call.status, 'disconnected'))
          ]))
            .then(() => call.hangup());
        });
      });
    });

    describe('#to', () => {
      it('represents the receiving party', () => handleErrorEvent(spock.spark.phone.dial(mccoy.email), (call) => Promise.all([
        expectCallIncomingEvent(mccoy.spark.phone)
          .then((c) => c.answer()),
        expectConnectedEvent(call)
          .then(() => {
            assert.property(call.to, 'isInitiator');
            assert.property(call.to, 'personId');
            assert.property(call.to, 'state');
            assert.isHydraID(call.to.personId);
            assert.isFalse(call.to.isInitiator);
            assert.equal(base64.decode(call.to.personId).split('/').pop(), mccoy.id);
          })
      ])));
    });

    describe('#from', () => {
      it('represents the initiating party', () => handleErrorEvent(spock.spark.phone.dial(mccoy.email), (call) => Promise.all([
        expectCallIncomingEvent(mccoy.spark.phone)
          .then((c) => c.answer()),
        expectConnectedEvent(call)
          .then(() => {
            assert.property(call.from, 'isInitiator');
            assert.property(call.from, 'personId');
            assert.property(call.from, 'state');
            assert.isHydraID(call.from.personId);
            assert.isTrue(call.from.isInitiator);
            assert.equal(base64.decode(call.from.personId).split('/').pop(), spock.id);
          })
      ])));
    });

    describe('#direction', () => {
      it('indicates the initiating and receiving members of the call', () => {
        const call = spock.spark.phone.dial(mccoy.email);
        assert.equal(call.direction, 'out');
        return handleErrorEvent(call, () => expectCallIncomingEvent(mccoy.spark.phone)
          .then((c) => {
            assert.equal(call.direction, 'out');
            assert.property(c, 'locus');
            assert.isDefined(c.locus);
            assert.property(c, 'direction');
            assert.isDefined(c.direction);
            assert.equal(c.direction, 'in');
          }));
      });
    });

    describe('#remoteMediaStream', () => {
      describe('after the call is connected', () => {
        it('is a media stream', () => handleErrorEvent(spock.spark.phone.dial(mccoy.email), (call) => Promise.all([
          expectCallIncomingEvent(mccoy.spark.phone)
            .then((c) => c.answer()),
          expectConnectedEvent(call)
            .then(() => assert.instanceOf(call.remoteMediaStream, MediaStream))
        ])));
      });
    });

    describe('#answer()', () => {
      it('accepts an incoming call', () => {
        const call = mccoy.spark.phone.dial(spock.email);
        return handleErrorEvent(call, () => Promise.all([
          expectCallIncomingEvent(spock.spark.phone)
            .then((c) => c.answer()),
          expectConnectedEvent(call)
            .then(() => assert.equal(call.status, 'connected'))
        ]));
      });

      it('accepts an active outgoing call that is not already joined', () => handleErrorEvent(mccoy.spark.phone.dial(spock.email), (call) => Promise.all([
        expectCallIncomingEvent(spock.spark.phone)
          .then((c) => c.answer()),
        expectConnectedEvent(call)
          .then(() => assert.equal(call.status, 'connected'))
      ])
        .then(() => mccoy.spark.internal.mercury.disconnect())
        .then(() => Promise.all([
          expectCallCreatedEvent(mccoy.spark.phone),
          mccoy.spark.phone.register()
        ]))
        .then(([mccoyCall]) => Promise.all([
          expectConnectedEvent(mccoyCall),
          mccoyCall.answer()
        ])
          .then(() => assert.equal(call.status, 'connected')))));

      it('is a noop for outbound calls', () => {
        sinon.spy(spock.spark.internal.locus, 'create');
        return handleErrorEvent(spock.spark.phone.dial(mccoy.id), (call) => {
          sinon.spy(call.spark.internal.locus, 'join');

          // block until we're sure locus.create() has necessarily been called
          return expectEvent(3000, 'change:locus', call)
            .then(() => call.answer())
            .then(() => {
              // We called create() to create the call
              assert.called(spock.spark.internal.locus.create);

              // But we did not call join() when we invoked answer()
              assert.notCalled(call.spark.internal.locus.join);

              call.spark.internal.locus.create.restore();
              call.spark.internal.locus.join.restore();
            });
        });
      });

      it('is a noop for answered calls', () => handleErrorEvent(spock.spark.phone.dial(mccoy.id), () => expectCallIncomingEvent(mccoy.spark.phone)
        .then((c) => {
          sinon.spy(c, 'createOrJoinLocus');
          return c.answer()
            .then(() => c.answer())
            .then(() => assert.calledOnce(c.createOrJoinLocus));
        })));
    });

    describe('#hangup()', () => {
      it('gets called when the local party is the last member of the call', () => {
        const handler = handleErrorEvent(spock.spark.phone.dial(mccoy.email), (call) => {
          let mccoyCall;
          return Promise.all([
            expectCallIncomingEvent(mccoy.spark.phone)
              .then((c) => {
                handler.add(c);
                mccoyCall = c;
                return c.answer();
              }),
            expectConnectedEvent(call)
          ])
            .then(() => {
              assert.equal(call.status, 'connected');
              assert.equal(mccoyCall.status, 'connected');
              assert.equal(call.activeParticipantsCount, 2);
              assert.equal(mccoyCall.activeParticipantsCount, 2);
              const hangupSpy = sinon.spy(call, 'hangup');
              return Promise.all([
                expectDisconnectedEvent(call),
                mccoyCall.hangup()
              ])
                .then(() => assert.called(hangupSpy));
            });
        });

        return handler;
      });

      it('gets called when the remote party declines the call', () => {
        const handler = handleErrorEvent(spock.spark.phone.dial(mccoy.email), (call) => expectCallIncomingEvent(mccoy.spark.phone)
          .then((c) => {
            handler.add(c);
            const hangupSpy = sinon.spy(call, 'hangup');
            return Promise.all([
              c.hangup(),
              expectDisconnectedEvent(call)
            ])
              .then(() => assert.called(hangupSpy));
          }));

        return handler;
      });
    });

    describe('#reject()', () => {
      it('declines an incoming call', () => handleErrorEvent(spock.spark.phone.dial(mccoy.email), (call) => Promise.all([
        expectCallIncomingEvent(mccoy.spark.phone)
          .then((c) => {
            c.reject();
          }),
        expectDisconnectedEvent(call)
          .then(() => assert.equal(call.status, 'disconnected'))
      ])));

      it('is a noop for outbound calls', () => handleErrorEvent(spock.spark.phone.dial(mccoy.email), (call) => Promise.all([
        call.reject(),
        expectCallIncomingEvent(mccoy.spark.phone)
          .then((c) => c.acknowledge()),
        expectRingingEvent(call)
      ])
        .then(() => assert.equal(call.status, 'ringing'))));

      it('is a noop for answered calls', () => handleErrorEvent(spock.spark.phone.dial(mccoy.email), (call) => Promise.all([
        expectCallIncomingEvent(mccoy.spark.phone)
          .then((c) => c.answer()),
        expectConnectedEvent(call)
          .then(() => call.reject())
      ])
        .then(() => assert.equal(call.status, 'connected'))));
    });

    describe('#toggleFacingMode', () => {
      describe('when the facing mode is "user"', () => {
        it('changes the facing mode to "environment"', () => handleErrorEvent(spock.spark.phone.dial(mccoy.email), (call) => Promise.all([
          expectCallIncomingEvent(mccoy.spark.phone)
            .then((c) => c.answer()),
          expectConnectedEvent(call)
            .then(() => assert.equal(call.facingMode, 'user'))
            .then(() => call.toggleFacingMode())
            .then(() => assert.equal(call.facingMode, 'environment'))
        ])));
      });

      describe('when the facing mode is "environment"', () => {
        it('changes the facing mode to "user"', () => {
          spock.spark.phone.defaultFacingMode = 'environment';
          return handleErrorEvent(spock.spark.phone.dial(mccoy.email), (call) => Promise.all([
            expectCallIncomingEvent(mccoy.spark.phone)
              .then((c) => c.answer()),
            expectConnectedEvent(call)
              .then(() => assert.equal(call.facingMode, 'environment'))
              .then(() => call.toggleFacingMode())
              .then(() => assert.equal(call.facingMode, 'user'))
          ]));
        });
      });
    });

    describe('on(error)', () => {
      it('gets triggered when something fails in a non-promise-returning method', () => {
        this.timeout(30000);
        const call = spock.spark.phone.dial('no one');

        const errorSpy = sinon.spy();
        call.on('error', errorSpy);
        return expectErrorEvent(call)
          .then(() => assert.called(errorSpy));
      });
    });
  });
});
