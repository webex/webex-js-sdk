/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import '@ciscospark/plugin-phone';

import {assert} from '@ciscospark/test-helper-chai';
import CiscoSpark from '@ciscospark/spark-core';
import testUsers from '@ciscospark/test-helper-test-users';
import sinon from '@ciscospark/test-helper-sinon';
import {
  browserOnly,
  handleErrorEvent
} from '@ciscospark/test-helper-mocha';

import {
  expectCallIncomingEvent,
  expectChangeLocusEvent,
  expectMembershipConnectedEvent,
  expectMembershipDeclinedEvent,
  expectMembershipDisconnectedEvent,
  expectMembershipEvent,
  expectInactiveEvent
} from '../lib/event-expectations';

if (process.env.NODE_ENV !== 'test') {
  throw new Error('Cannot run the plugin-phone test suite without NODE_ENV === "test"');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setup(users, assign) {
  assert.property(users, 'spock', 'This test helper requires that you always have a user named "spock"');
  before('create users and register', () => testUsers.create({count: Object.keys(users).length})
    .then((created) => Promise.all(Object.keys(users).map((name, index) => {
      // eslint-disable-next-line no-param-reassign
      users[name] = created[index];
      const user = users[name];
      user.spark = new CiscoSpark({
        credentials: {
          authorization: user.token
        }
      });

      return user.spark.phone.register();
    }))));

  beforeEach('enable group calling', () => Object.values(users).forEach((user) => {
    if (user) {
      // eslint-disable-next-line no-param-reassign
      user.spark.config.phone.enableExperimentalGroupCallingSupport = true;
    }
  }));

  beforeEach(() => users.spock.spark.request({
    method: 'POST',
    service: 'hydra',
    resource: 'rooms',
    body: {
      title: 'Call Test'
    }
  })
    .then((res) => {
      const room = res.body;
      return Promise.resolve(assign(room))
        .then(() => room);
    })
    .then((room) => Promise.all(Object.values(users)
      .filter((user) => user !== users.spock)
      .map((user) => users.spock.spark.request({
        method: 'POST',
        service: 'hydra',
        resource: 'memberships',
        body: {
          roomId: room.id,
          personId: user.id
        }
      })))));

  afterEach('disable group calling', () => Object.values(users).forEach((user) => {
    if (user) {
      // eslint-disable-next-line no-param-reassign
      user.spark.config.phone.enableExperimentalGroupCallingSupport = false;
    }
  }));

  after('unregister users', () => Promise.all(Object.entries(users).map(([name, user]) => user && user.spark.phone.deregister()
    // eslint-disable-next-line no-console
    .catch((reason) => console.warn(`could not unregister ${name}`, reason)))));
}

function findMembership(call, user) {
  return call.memberships.find((m) => m.personUuid === user.id);
}

browserOnly(describe)('plugin-phone', function () {
  this.timeout(120000);

  describe('Call', () => {
    describe('Events Model', () => {
      describe('a 1:1 call', () => {
        let mccoy, spock;
        const users = {
          mccoy: null,
          spock: null
        };

        setup(users, () => {
          ({mccoy} = users);
          ({spock} = users);
        });

        it('proceeds through a series of events', () => handleErrorEvent(spock.spark.phone.dial(mccoy.id), async (sc) => {
          // This is more to prove our assumptions about the test than to require
          // a particular code behavior.
          assert.notOk(sc.locus, 'We never expect the call to have a locus on the first tick; if this assertion does not hold, it is a sign the test suite assumptions were incorrect');

          const [mc] = await Promise.all([
            expectCallIncomingEvent(mccoy.spark.phone, 'mccoy expects to receive a call notification'),
            expectChangeLocusEvent(sc, 'spock expects to receive a locus')
              .then(() => {
                assert.equal(sc.state, 'active', 'spock\'s call goes active when the locus arrives');
                assert.equal(sc.me.state, 'connected', 'spock\'s participant entry goes active when the locus arrives');
                assert.equal(findMembership(sc, mccoy).state, 'notified', 'spock expects mccoy to be notified');
              })
          ]);

          assert.equal(mc.me.state, 'notified');
          assert.equal(findMembership(mc, spock).state, 'connected', 'mccoy expects spock to be be connected when mccoy receives the call');

          await Promise.all([
            expectMembershipConnectedEvent(sc, mccoy.id, 'spock expects mccoy to join the call'),
            expectMembershipConnectedEvent(mc, mccoy.id, 'mccoy expects mccoy to join the call'),
            mc.answer()
          ]);

          assert.equal(sc.me.state, 'connected');
          assert.equal(findMembership(sc, mccoy).state, 'connected', 'spock expects mccoy to be connected once mccoy joins');
          assert.equal(mc.me.state, 'connected');
          assert.equal(findMembership(mc, spock).state, 'connected', 'mccoy expects spock to be connected once mccoy joins');

          await Promise.all([
            expectMembershipDisconnectedEvent(sc, mccoy.id, 'spock expects mccoy to disconnect'),
            expectInactiveEvent(mc, 'mccoy expects the call to go inactive after spock leaves the call'),
            expectMembershipDisconnectedEvent(sc, spock.id, 'spock expects spock to disconnect when mccoy disconnects'),
            expectInactiveEvent(sc, 'spock expects the call to go inactive after spock leaves the call'),
            mc.hangup()
          ]);

          assert.equal(findMembership(sc, mccoy).state, 'disconnected', 'spock expects mccoy to be disconnected once mccoy leaves');
          assert.equal(sc.me.state, 'disconnected', 'spock expects to be disconnected after spock leaves');
          assert.equal(sc.state, 'inactive', 'spock expects the call to go inactive after spock leaves');

          assert.equal(mc.me.state, 'disconnected', 'mccoy expects to be disconnected once mccoy leaves the call');
          assert.equal(findMembership(mc, spock).state, 'disconnected', 'mccoy expects to be disconnected after spock leaves');
          assert.equal(mc.state, 'inactive', 'mccoy expects the call to go inactive after spock leaves');
        }));
      });

      describe('a two party room call', () => {
        let mccoy, room, spock;
        const users = {
          mccoy: null,
          spock: null
        };

        setup(users, (r) => {
          ({mccoy} = users);
          ({spock} = users);
          room = r;
        });

        it('proceeds through a series of events', () => handleErrorEvent(spock.spark.phone.dial(room.id), async (sc) => {
          // This is more to prove our assumptions about the test than to require
          // a particular code behavior.
          assert.notOk(sc.locus, 'We never expect the call to have a locus on the first tick; if this assertion does not hold, it is a sign the test suite assumptions were incorrect');

          const [mc] = await Promise.all([
            expectCallIncomingEvent(mccoy.spark.phone, 'mccoy expects to receive a call notification'),
            expectChangeLocusEvent(sc, 'spock expects to receive a locus')
              .then(() => {
                assert.equal(sc.state, 'active', 'spock\'s call goes active when the locus arrives');
                assert.equal(sc.me.state, 'connected', 'spock\'s participant entry goes active when the locus arrives');
                assert.equal(findMembership(sc, mccoy).state, 'notified', 'spock expects mccoy to be notified');
              })
          ]);

          assert.equal(mc.me.state, 'notified');
          assert.equal(findMembership(mc, spock).state, 'connected', 'mccoy expects spock to be be connected when mccoy receives the call');

          await Promise.all([
            expectMembershipConnectedEvent(sc, mccoy.id, 'spock expects mccoy to join the call'),
            expectMembershipConnectedEvent(mc, mccoy.id, 'mccoy expects mccoy to join the call'),
            mc.answer()
          ]);

          assert.equal(sc.me.state, 'connected');
          assert.equal(findMembership(sc, mccoy).state, 'connected', 'spock expects mccoy to be connected once mccoy joins');
          assert.equal(mc.me.state, 'connected');
          assert.equal(findMembership(mc, spock).state, 'connected', 'mccoy expects spock to be connected once mccoy joins');

          await Promise.all([
            expectMembershipDisconnectedEvent(sc, mccoy.id, 'spock expects mccoy to disconnect'),
            mc.hangup()
          ]);

          assert.equal(findMembership(sc, mccoy).state, 'disconnected', 'spock expects mccoy to be disconnected once mccoy leaves');
          assert.equal(mc.me.state, 'disconnected', 'mccoy expects to be disconnected once mccoy leaves the call');
          assert.equal(mc.state, 'active', 'mccoy expects the call to remain active after mccoy leaves');

          // I don't know any way to assert an event did not fire other than to
          // wait a while and check if it fired
          await sleep(1000);
          assert.equal(sc.me.state, 'connected', 'spock expects to stay connected after mccoy leaves');
          assert.equal(sc.state, 'active', 'spock expects the call to remain active after mccoy leaves');

          await Promise.all([
            expectMembershipDisconnectedEvent(sc, spock.id, 'spock expects spock to disconnect'),
            expectInactiveEvent(sc, 'spock expects the call to go inactive after leaving the call'),
            expectInactiveEvent(mc, 'mccoy expects the call to go inactive after spock leaves the call'),
            sc.hangup()
          ]);

          assert.equal(sc.me.state, 'disconnected', 'spock expects to be disconnected after spock leaves');
          assert.equal(findMembership(mc, spock).state, 'disconnected', 'mccoy expects to be disconnected after spock leaves');
          assert.equal(sc.state, 'inactive', 'spock expects the call to go inactive after spock leaves');
          assert.equal(mc.state, 'inactive', 'mccoy expects the call to go inactive after spock leaves');
        }));
      });

      describe('a declined two party room call', () => {
        let mccoy, room, spock;
        const users = {
          mccoy: null,
          spock: null
        };

        setup(users, (r) => {
          ({mccoy} = users);
          ({spock} = users);
          room = r;
        });

        it('proceeds through a series of events', () => handleErrorEvent(spock.spark.phone.dial(room.id), async (sc) => {
          // This is more to prove our assumptions about the test than to require
          // a particular code behavior.
          assert.notOk(sc.locus, 'We never expect the call to have a locus on the first tick; if this assertion does not hold, it is a sign the test suite assumptions were incorrect');

          const [mc] = await Promise.all([
            expectCallIncomingEvent(mccoy.spark.phone, 'mccoy expects to receive a call notification'),
            expectChangeLocusEvent(sc, 'spock expects to receive a locus')
              .then(() => {
                assert.equal(sc.state, 'active', 'spock\'s call goes active when the locus arrives');
                assert.equal(sc.me.state, 'connected', 'spock\'s participant entry goes active when the locus arrives');
                assert.equal(findMembership(sc, mccoy).state, 'notified', 'spock expects mccoy to be notified');
              })
          ]);

          assert.equal(mc.me.state, 'notified');
          assert.equal(findMembership(mc, spock).state, 'connected', 'mccoy expects spock to be be connected when mccoy receives the call');

          await Promise.all([
            expectMembershipDeclinedEvent(sc, mccoy.id, 'spock expects mccoy to decline the call'),
            expectMembershipDeclinedEvent(mc, mccoy.id, 'mccoy expects mccoy to decline the call'),
            // Ideally, we would assert the following, but the event listener
            // has been disconnected at this point.
            // expectDeclinedEvent(mc, `mccoy expects to decline`),
            mc.decline()
          ]);

          assert.equal(sc.me.state, 'connected');
          assert.equal(findMembership(sc, mccoy).state, 'declined', 'spock expects mccoy to be disconnected once mccoy joins');
          assert.equal(mc.me.state, 'declined');
          assert.equal(findMembership(mc, spock).state, 'connected', 'mccoy expects spock to be connected once mccoy joins');
          assert.equal(sc.state, 'active');

          // I don't know any way to assert an event did not fire other than to
          // wait a while and check if it fired
          await sleep(1000);
          assert.equal(sc.me.state, 'connected', 'spock expects to stay connected after mccoy leaves');
          assert.equal(sc.state, 'active', 'spock expects the call to remain active after mccoy leaves');
          assert.equal(mc.state, 'active', 'mccoy expects the call to remain active after mccoy leaves');

          await Promise.all([
            expectMembershipDisconnectedEvent(sc, spock.id, 'spock expects spock to disconnect'),
            expectInactiveEvent(sc, 'spock expects the call to go inactive after leaving the call'),
            sc.hangup()
          ]);

          assert.equal(sc.me.state, 'disconnected', 'spock expects to be disconnected after spock leaves');
          // Ideally, we would assert the following, but the event listener has
          // been disconnected at this point.
          // eslint-disable-next-line max-len
          // assert.equal(findMembership(mc, spock).state,`disconnected`, `mccoy expects to be disconnected after spock leaves`);
          // assert.equal(sc.state, `inactive`, `spock expects the call to go inactive after spock leaves`);
          // assert.equal(mc.state, `inactive`, `mccoy expects the call to go inactive after spock leaves`);
        }));
      });

      describe('a two party room call', () => {
        let mccoy, room, spock;
        const users = {
          mccoy: null,
          spock: null
        };

        setup(users, (r) => {
          ({mccoy} = users);
          ({spock} = users);
          room = r;
        });

        it('proceeds through a series of events', () => handleErrorEvent(spock.spark.phone.dial(room.id), async (sc) => {
          // This is more to prove our assumptions about the test than to require
          // a particular code behavior.
          assert.notOk(sc.locus, 'We never expect the call to have a locus on the first tick; if this assertion does not hold, it is a sign the test suite assumptions were incorrect');

          const [mc] = await Promise.all([
            expectCallIncomingEvent(mccoy.spark.phone, 'mccoy expects to receive a call notification'),
            expectChangeLocusEvent(sc, 'spock expects to receive a locus')
              .then(() => {
                assert.equal(sc.state, 'active', 'spock\'s call goes active when the locus arrives');
                assert.equal(sc.me.state, 'connected', 'spock\'s participant entry goes active when the locus arrives');
                assert.equal(findMembership(sc, mccoy).state, 'notified', 'spock expects mccoy to be notified');
              })
          ]);

          assert.equal(mc.me.state, 'notified');
          assert.equal(findMembership(mc, spock).state, 'connected', 'mccoy expects spock to be be connected when mccoy receives the call');

          await Promise.all([
            expectMembershipConnectedEvent(sc, mccoy.id, 'spock expects mccoy to join the call'),
            expectMembershipConnectedEvent(mc, mccoy.id, 'mccoy expects mccoy to join the call'),
            mc.answer()
          ]);

          assert.equal(sc.me.state, 'connected');
          assert.equal(findMembership(sc, mccoy).state, 'connected', 'spock expects mccoy to be connected once mccoy joins');
          assert.equal(mc.me.state, 'connected');
          assert.equal(findMembership(mc, spock).state, 'connected', 'mccoy expects spock to be connected once mccoy joins');

          await Promise.all([
            expectMembershipEvent('membership:change', sc, mccoy.id, 'spock expects mccoy to mute')
              .then((membership) => {
                assert.equal(membership.personUuid, mccoy.id);
                assert.isTrue(membership.audioMuted, 'spock sees mccoy\'s audio as muted');
              }),
            expectMembershipEvent('membership:change', mc, mccoy.id, 'mccoy expects mccoy to mute')
              .then((membership) => {
                assert.equal(membership.personUuid, mccoy.id);
                assert.isTrue(membership.audioMuted, 'mccoy sees mccoy\'s audio as muted');
              }),
            mc.toggleSendingAudio()
          ]);

          await Promise.all([
            expectMembershipDisconnectedEvent(sc, mccoy.id, 'spock expects mccoy to disconnect'),
            mc.hangup()
          ]);

          assert.equal(findMembership(sc, mccoy).state, 'disconnected', 'spock expects mccoy to be disconnected once mccoy leaves');
          assert.equal(mc.me.state, 'disconnected', 'mccoy expects to be disconnected once mccoy leaves the call');
          assert.equal(mc.state, 'active', 'mccoy expects the call to remain active after mccoy leaves');

          // I don't know any way to assert an event did not fire other than to
          // wait a while and check if it fired
          await sleep(1000);
          assert.equal(sc.me.state, 'connected', 'spock expects to stay connected after mccoy leaves');
          assert.equal(sc.state, 'active', 'spock expects the call to remain active after mccoy leaves');

          await Promise.all([
            expectMembershipDisconnectedEvent(sc, spock.id, 'spock expects spock to disconnect'),
            expectInactiveEvent(sc, 'spock expects the call to go inactive after leaving the call'),
            expectInactiveEvent(mc, 'mccoy expects the call to go inactive after spock leaves the call'),
            sc.hangup()
          ]);

          assert.equal(sc.me.state, 'disconnected', 'spock expects to be disconnected after spock leaves');
          assert.equal(findMembership(mc, spock).state, 'disconnected', 'mccoy expects to be disconnected after spock leaves');
          assert.equal(sc.state, 'inactive', 'spock expects the call to go inactive after spock leaves');
          assert.equal(mc.state, 'inactive', 'mccoy expects the call to go inactive after spock leaves');
        }));
      });

      describe('two party room call with inactive member', () => {
        let mccoy, room, spock;
        const users = {
          checkov: null,
          mccoy: null,
          spock: null
        };

        setup(users, (r) => {
          ({mccoy} = users);
          ({spock} = users);
          room = r;
        });

        it('proceeds through a series of events', () => handleErrorEvent(spock.spark.phone.dial(room.id), async (sc) => {
          // This is more to prove our assumptions about the test than to require
          // a particular code behavior.
          assert.notOk(sc.locus, 'We never expect the call to have a locus on the first tick; if this assertion does not hold, it is a sign the test suite assumptions were incorrect');

          const [mc] = await Promise.all([
            expectCallIncomingEvent(mccoy.spark.phone, 'mccoy expects to receive a call notification'),
            expectChangeLocusEvent(sc, 'spock expects to receive a locus')
              .then(() => {
                assert.equal(sc.state, 'active', 'spock\'s call goes active when the locus arrives');
                assert.equal(sc.me.state, 'connected', 'spock\'s participant entry goes active when the locus arrives');
                assert.equal(findMembership(sc, mccoy).state, 'notified', 'spock expects mccoy to be notified');
              })
          ]);

          assert.equal(mc.me.state, 'notified');
          assert.equal(mc.state, 'active');
          assert.equal(findMembership(mc, spock).state, 'connected', 'mccoy expects spock to be be connected when mccoy receives the call');

          await Promise.all([
            expectMembershipConnectedEvent(sc, mccoy.id, 'spock expects mccoy to join the call'),
            expectMembershipConnectedEvent(mc, mccoy.id, 'mccoy expects mccoy to join the call'),
            mc.answer()
          ]);

          assert.equal(sc.me.state, 'connected');
          assert.equal(findMembership(sc, mccoy).state, 'connected', 'spock expects mccoy to be connected once mccoy joins');
          assert.equal(mc.me.state, 'connected');
          assert.equal(findMembership(mc, spock).state, 'connected', 'mccoy expects spock to be connected once mccoy joins');

          await Promise.all([
            expectMembershipDisconnectedEvent(sc, mccoy.id, 'spock expects mccoy to disconnect'),
            mc.hangup()
          ]);

          assert.equal(findMembership(sc, mccoy).state, 'disconnected', 'spock expects mccoy to be disconnected once mccoy leaves');
          assert.equal(mc.me.state, 'disconnected', 'mccoy expects to be disconnected once mccoy leaves the call');
          assert.equal(mc.state, 'active', 'mccoy expects the call to remain active after mccoy leaves');

          // I don't know any way to assert an event did not fire other than to
          // wait a while and check if it fired
          await sleep(1000);
          assert.equal(sc.me.state, 'connected', 'spock expects to stay connected after mccoy leaves');
          assert.equal(sc.state, 'active', 'spock expects the call to remain active after mccoy leaves');

          await Promise.all([
            expectMembershipDisconnectedEvent(sc, spock.id, 'spock expects spock to disconnect'),
            expectInactiveEvent(sc, 'spock expects the call to go inactive after leaving the call'),
            expectInactiveEvent(mc, 'mccoy expects the call to go inactive after spock leaves the call'),
            sc.hangup()
          ]);

          assert.equal(sc.me.state, 'disconnected', 'spock expects to be disconnected after spock leaves');
          assert.equal(findMembership(mc, spock).state, 'disconnected', 'mccoy expects to be disconnected after spock leaves');
          assert.equal(sc.state, 'inactive', 'spock expects the call to go inactive after spock leaves');
          assert.equal(mc.state, 'inactive', 'mccoy expects the call to go inactive after spock leaves');
        }));
      });

      describe('a three party room call', () => {
        let checkov, mccoy, room, spock;
        const users = {
          checkov: null,
          mccoy: null,
          spock: null
        };

        setup(users, (r) => {
          ({checkov} = users);
          ({mccoy} = users);
          ({spock} = users);
          room = r;
        });

        // eslint-disable-next-line max-statements
        it('proceeds through a series of events', () => handleErrorEvent(spock.spark.phone.dial(room.id), async (sc) => {
          // This is more to prove our assumptions about the test than to require
          // a particular code behavior.
          assert.notOk(sc.locus, 'We never expect the call to have a locus on the first tick; if this assertion does not hold, it is a sign the test suite assumptions were incorrect');

          const [mc, cc] = await Promise.all([
            expectCallIncomingEvent(mccoy.spark.phone, 'mccoy expects to receive a call notification'),
            expectCallIncomingEvent(checkov.spark.phone, 'checkov expects to receive a call notification'),

            expectChangeLocusEvent(sc, 'spock expects to receive a locus')
              .then(() => {
                assert.equal(sc.state, 'active', 'spock\'s call goes active when the locus arrives');
                assert.equal(sc.me.state, 'connected', 'spock\'s participant entry goes active when the locus arrives');
                assert.equal(findMembership(sc, mccoy).state, 'notified', 'spock expects mccoy to be notified');
                assert.equal(findMembership(sc, checkov).state, 'notified', 'spock expects checkov to be notified');
              })
          ]);

          assert.equal(mc.me.state, 'notified');
          assert.equal(cc.me.state, 'notified');
          assert.equal(findMembership(mc, spock).state, 'connected', 'mccoy expects spock to be be connected when mccoy receives the call');
          assert.equal(findMembership(cc, spock).state, 'connected', 'checkov expects spock to be be connected when checkov receives the call');

          assert.equal(mc.state, 'active');
          assert.equal(cc.state, 'active');

          await Promise.all([
            expectMembershipConnectedEvent(sc, mccoy.id, 'spock expects mccoy to join the call'),
            expectMembershipConnectedEvent(mc, mccoy.id, 'mccoy expects mccoy to join the call'),
            expectMembershipConnectedEvent(cc, mccoy.id, 'checkov expects mccoy to join the call'),
            mc.answer()
          ]);

          await Promise.all([
            expectMembershipConnectedEvent(sc, checkov.id, 'spock expects checkov to join the call'),
            expectMembershipConnectedEvent(mc, checkov.id, 'mccoy expects checkov to join the call'),
            expectMembershipConnectedEvent(cc, checkov.id, 'checkov expects checkov to join the call'),
            cc.answer()
          ]);

          assert.equal(sc.me.state, 'connected');
          assert.equal(findMembership(sc, mccoy).state, 'connected', 'spock expects mccoy to be connected once mccoy joins');
          assert.equal(findMembership(sc, checkov).state, 'connected', 'spock expects checkov to be connected once checkov joins');
          assert.equal(mc.me.state, 'connected');
          assert.equal(findMembership(mc, spock).state, 'connected', 'mccoy expects spock to be connected once mccoy joins');
          assert.equal(findMembership(mc, checkov).state, 'connected', 'mccoy expects checkov to be connected once mccoy joins');
          assert.equal(cc.me.state, 'connected');
          assert.equal(findMembership(cc, spock).state, 'connected', 'checkov expects spock to be connected once checkov joins');
          assert.equal(findMembership(cc, checkov).state, 'connected', 'checkov expects checkov to be connected once checkov joins');

          await Promise.all([
            expectMembershipDisconnectedEvent(sc, mccoy.id, 'spock expects mccoy to disconnect'),
            expectMembershipDisconnectedEvent(sc, checkov.id, 'spock expects checkov to disconnect'),
            mc.hangup(),
            cc.hangup()
          ]);

          assert.equal(findMembership(sc, mccoy).state, 'disconnected', 'spock expects mccoy to be disconnected once mccoy leaves');
          assert.equal(findMembership(sc, checkov).state, 'disconnected', 'spock expects checkov to be disconnected once mccoy leaves');
          assert.equal(mc.me.state, 'disconnected', 'mccoy expects to be disconnected once mccoy leaves the call');
          assert.equal(cc.me.state, 'disconnected', 'checkov expects to be disconnected once checkov leaves the call');

          // I don't know any way to assert an event did not fire other than to
          // wait a while and check if it fired
          await sleep(1000);
          assert.equal(sc.me.state, 'connected', 'spock expects to remain connected after everyone else leaves');

          await Promise.all([
            expectMembershipDisconnectedEvent(sc, spock.id, 'spock expects spock to disconnect'),
            expectInactiveEvent(sc, 'spock expects the call to go inactive after leaving the call'),
            expectInactiveEvent(mc, 'mccoy expects the call to go inactive after spock leaves the call'),
            sc.hangup()
          ]);

          assert.equal(sc.me.state, 'disconnected', 'spock expects to be disconnected after spock leaves');
          assert.equal(findMembership(mc, spock).state, 'disconnected', 'mccoy expects to be disconnected after spock leaves');
          assert.equal(sc.state, 'inactive', 'spock expects the call to go inactive after spock leaves');
          assert.equal(mc.state, 'inactive', 'mccoy expects the call to go inactive after spock leaves');
        }));
      });

      describe('a four-party room call', () => {
        let checkov, mccoy, room, spock, uhura;
        const users = {
          checkov: null,
          mccoy: null,
          spock: null,
          uhura: null
        };

        setup(users, (r) => {
          ({checkov} = users);
          ({mccoy} = users);
          ({spock} = users);
          ({uhura} = users);
          room = r;
        });

        // eslint-disable-next-line max-statements
        it('proceeds through a series of events', () => handleErrorEvent(spock.spark.phone.dial(room.id), async (sc) => {
          // This is more to prove our assumptions about the test than to require
          // a particular code behavior.
          assert.notOk(sc.locus, 'We never expect the call to have a locus on the first tick; if this assertion does not hold, it is a sign the test suite assumptions were incorrect');

          const [mc, cc, uc] = await Promise.all([
            expectCallIncomingEvent(mccoy.spark.phone, 'mccoy expects to receive a call notification'),
            expectCallIncomingEvent(checkov.spark.phone, 'checkov expects to receive a call notification'),
            expectCallIncomingEvent(uhura.spark.phone, 'uhura expects to receive a call notification'),
            expectChangeLocusEvent(sc, 'spock expects to receive a locus')
              .then(() => {
                assert.equal(sc.state, 'active', 'spock\'s call goes active when the locus arrives');
                assert.equal(sc.me.state, 'connected', 'spock\'s participant entry goes active when the locus arrives');
                assert.equal(findMembership(sc, mccoy).state, 'notified', 'spock expects mccoy to be notified');
                assert.equal(findMembership(sc, checkov).state, 'notified', 'spock expects checkov to be notified');
                assert.equal(findMembership(sc, uhura).state, 'notified', 'spock expects uhura to be notified');
              })
          ]);

          await Promise.all([
            expectMembershipDeclinedEvent(sc, checkov.id, 'spock expects checkov to decline the call'),
            expectMembershipDeclinedEvent(mc, checkov.id, 'mccoy expects checkov to decline the call'),
            expectMembershipDeclinedEvent(uc, checkov.id, 'uhura expects checkov to decline the call'),
            expectMembershipDeclinedEvent(cc, checkov.id, 'checkov expects checkov to decline the call'),
            cc.decline(),

            expectMembershipConnectedEvent(sc, mccoy.id, 'spock expects mccoy to join the call'),
            expectMembershipConnectedEvent(mc, mccoy.id, 'mccoy expects mccoy to join the call'),
            expectMembershipConnectedEvent(uc, mccoy.id, 'uhura expects mccoy to join the call'),
            // expectMembershipConnectedEvent(cc, mccoy.id, `checkov expects mccoy to join the call`),
            mc.answer(),

            expectMembershipConnectedEvent(sc, uhura.id, 'spock expects uhura to join the call'),
            expectMembershipConnectedEvent(mc, uhura.id, 'mccoy expects uhura to join the call'),
            expectMembershipConnectedEvent(uc, uhura.id, 'uhura expects uhura to join the call'),
            // expectMembershipConnectedEvent(cc, uhura.id, `checkov expects uhura to join the call`),
            uc.answer()
          ]);

          await Promise.all([
            expectMembershipEvent('membership:change', sc, mccoy.id, 'spock expects mccoy to mute')
              .then((membership) => {
                assert.equal(membership.personUuid, mccoy.id);
                assert.isTrue(membership.audioMuted, 'spock sees mccoy\'s audio as muted');
              }),
            expectMembershipEvent('membership:change', uc, mccoy.id, 'uhura expects mccoy to mute')
              .then((membership) => {
                assert.equal(membership.personUuid, mccoy.id);
                assert.isTrue(membership.audioMuted, 'uhura sees mccoy\'s audio as muted');
              }),
            mc.toggleSendingAudio()
          ]);

          await Promise.all([
            expectMembershipDisconnectedEvent(sc, mccoy.id, 'spock expects mccoy to disconnect'),
            expectMembershipDisconnectedEvent(sc, uhura.id, 'spock expects uhura to disconnect'),
            mc.hangup(),
            uc.hangup()
          ]);

          assert.equal(findMembership(sc, mccoy).state, 'disconnected', 'spock expects mccoy to be disconnected once mccoy leaves');
          assert.equal(findMembership(sc, uhura).state, 'disconnected', 'spock expects uhura to be disconnected once uhura leaves');
          assert.equal(mc.me.state, 'disconnected', 'mccoy expects to be disconnected once mccoy leaves the call');
          assert.equal(uc.me.state, 'disconnected', 'uhura expects to be disconnected once uhura leaves the call');

          // I don't know any way to assert an event did not fire other than to
          // wait a while and check if it fired
          await sleep(1000);
          assert.equal(sc.me.state, 'connected', 'spock expects to remain connected after everyone else leaves');

          await Promise.all([
            expectMembershipDisconnectedEvent(sc, spock.id, 'spock expects spock to disconnect'),
            expectInactiveEvent(sc, 'spock expects the call to go inactive after leaving the call'),
            expectInactiveEvent(mc, 'mccoy expects the call to go inactive after spock leaves the call'),
            sc.hangup()
          ]);

          assert.equal(sc.me.state, 'disconnected', 'spock expects to be disconnected after spock leaves');
          assert.equal(findMembership(mc, spock).state, 'disconnected', 'mccoy expects to be disconnected after spock leaves');
          assert.equal(sc.state, 'inactive', 'spock expects the call to go inactive after spock leaves');
          assert.equal(mc.state, 'inactive', 'mccoy expects the call to go inactive after spock leaves');
        }));
      });

      describe('a delta-event-enabled room call', () => {
        let mccoy, room, spock;
        const users = {
          checkov: null,
          kirk: null,
          mccoy: null,
          spock: null,
          uhura: null,
          rs1: null,
          rs2: null,
          rs3: null,
          rs4: null,
          rs5: null,
          rs6: null,
          rs7: null,
          rs8: null,
          rs9: null,
          rs10: null
        };

        setup(users, (r) => {
          ({mccoy} = users);
          ({spock} = users);
          room = r;
        });

        beforeEach('set toggles', () => spock.spark.internal.feature.setFeature('developer', 'locus-delta-event', true));

        // eslint-disable-next-line max-statements
        it('proceeds through a series of events', () => handleErrorEvent(spock.spark.phone.dial(room.id), async (sc) => {
          const spockDelta = sinon.spy();
          spock.spark.internal.mercury.on('event:locus.difference', spockDelta);

          // This is more to prove our assumptions about the test than to require
          // a particular code behavior.
          assert.notOk(sc.locus, 'We never expect the call to have a locus on the first tick; if this assertion does not hold, it is a sign the test suite assumptions were incorrect');

          const [mc] = await Promise.all([
            expectCallIncomingEvent(mccoy.spark.phone, 'mccoy expects to receive a call notification'),
            expectChangeLocusEvent(sc, 'spock expects to receive a locus')
              .then(() => {
                assert.equal(sc.state, 'active', 'spock\'s call goes active when the locus arrives');
                assert.equal(sc.me.state, 'connected', 'spock\'s participant entry goes active when the locus arrives');
                assert.equal(findMembership(sc, mccoy).state, 'notified', 'spock expects mccoy to be notified');
              })
          ]);

          await Promise.all([
            expectMembershipConnectedEvent(sc, mccoy.id, 'spock expects mccoy to join the call'),
            expectMembershipConnectedEvent(mc, mccoy.id, 'mccoy expects mccoy to join the call'),
            mc.answer()
          ]);

          await Promise.all([
            expectMembershipEvent('membership:change', sc, mccoy.id, 'spock expects mccoy to mute')
              .then((membership) => {
                assert.equal(membership.personUuid, mccoy.id);
                assert.isTrue(membership.audioMuted, 'spock sees mccoy\'s audio as muted');
              }),
            mc.toggleSendingAudio()
          ]);

          await Promise.all([
            expectMembershipDisconnectedEvent(sc, mccoy.id, 'spock expects mccoy to disconnect'),
            mc.hangup()
          ]);

          assert.equal(findMembership(sc, mccoy).state, 'disconnected', 'spock expects mccoy to be disconnected once mccoy leaves');
          assert.equal(mc.me.state, 'disconnected', 'mccoy expects to be disconnected once mccoy leaves the call');

          // I don't know any way to assert an event did not fire other than to
          // wait a while and check if it fired
          await sleep(1000);
          assert.equal(sc.me.state, 'connected', 'spock expects to remain connected after everyone else leaves');

          await Promise.all([
            expectMembershipDisconnectedEvent(sc, spock.id, 'spock expects spock to disconnect'),
            expectInactiveEvent(sc, 'spock expects the call to go inactive after leaving the call'),
            expectInactiveEvent(mc, 'mccoy expects the call to go inactive after spock leaves the call'),
            sc.hangup()
          ]);

          assert.equal(sc.me.state, 'disconnected', 'spock expects to be disconnected after spock leaves');
          assert.equal(findMembership(mc, spock).state, 'disconnected', 'mccoy expects to be disconnected after spock leaves');
          assert.equal(sc.state, 'inactive', 'spock expects the call to go inactive after spock leaves');
          assert.equal(mc.state, 'inactive', 'mccoy expects the call to go inactive after spock leaves');

          assert.called(spockDelta);
        }));
      });

      describe('a room identified by sip uri', () => {
        let mccoy, room, spock;
        const users = {
          mccoy: null,
          spock: null
        };

        setup(users, (r) => {
          ({mccoy} = users);
          ({spock} = users);

          return spock.spark.request({
            method: 'GET',
            service: 'hydra',
            resource: `rooms/${r.id}`
          })
            .then((res) => {
              room = res.body;
            });
        });

        it('proceeds through a series of events', () => handleErrorEvent(spock.spark.phone.dial(room.sipAddress), async (sc) => {
          // This is more to prove our assumptions about the test than to require
          // a particular code behavior.
          assert.notOk(sc.locus, 'We never expect the call to have a locus on the first tick; if this assertion does not hold, it is a sign the test suite assumptions were incorrect');

          const [mc] = await Promise.all([
            expectCallIncomingEvent(mccoy.spark.phone, 'mccoy expects to receive a call notification'),
            expectChangeLocusEvent(sc, 'spock expects to receive a locus')
              .then(() => {
                assert.equal(sc.state, 'active', 'spock\'s call goes active when the locus arrives');
                assert.equal(sc.me.state, 'connected', 'spock\'s participant entry goes active when the locus arrives');
                assert.equal(findMembership(sc, mccoy).state, 'notified', 'spock expects mccoy to be notified');
              })
          ]);

          assert.equal(mc.me.state, 'notified');
          assert.equal(findMembership(mc, spock).state, 'connected', 'mccoy expects spock to be be connected when mccoy receives the call');

          await Promise.all([
            expectMembershipConnectedEvent(sc, mccoy.id, 'spock expects mccoy to join the call'),
            expectMembershipConnectedEvent(mc, mccoy.id, 'mccoy expects mccoy to join the call'),
            mc.answer()
          ]);

          assert.equal(sc.me.state, 'connected');
          assert.equal(findMembership(sc, mccoy).state, 'connected', 'spock expects mccoy to be connected once mccoy joins');
          assert.equal(mc.me.state, 'connected');
          assert.equal(findMembership(mc, spock).state, 'connected', 'mccoy expects spock to be connected once mccoy joins');

          await Promise.all([
            expectMembershipDisconnectedEvent(sc, mccoy.id, 'spock expects mccoy to disconnect'),
            mc.hangup()
          ]);

          assert.equal(findMembership(sc, mccoy).state, 'disconnected', 'spock expects mccoy to be disconnected once mccoy leaves');
          assert.equal(mc.me.state, 'disconnected', 'mccoy expects to be disconnected once mccoy leaves the call');
          assert.equal(mc.state, 'active', 'mccoy expects the call to remain active after mccoy leaves');

          // I don't know any way to assert an event did not fire other than to
          // wait a while and check if it fired
          await sleep(1000);
          assert.equal(sc.me.state, 'connected', 'spock expects to stay connected after mccoy leaves');
          assert.equal(sc.state, 'active', 'spock expects the call to remain active after mccoy leaves');

          await Promise.all([
            expectMembershipDisconnectedEvent(sc, spock.id, 'spock expects spock to disconnect'),
            expectInactiveEvent(sc, 'spock expects the call to go inactive after leaving the call'),
            expectInactiveEvent(mc, 'mccoy expects the call to go inactive after spock leaves the call'),
            sc.hangup()
          ]);

          assert.equal(sc.me.state, 'disconnected', 'spock expects to be disconnected after spock leaves');
          assert.equal(findMembership(mc, spock).state, 'disconnected', 'mccoy expects to be disconnected after spock leaves');
          assert.equal(sc.state, 'inactive', 'spock expects the call to go inactive after spock leaves');
          assert.equal(mc.state, 'inactive', 'mccoy expects the call to go inactive after spock leaves');
        }));
      });
    });
  });
});
