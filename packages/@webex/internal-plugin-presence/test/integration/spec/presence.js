/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/internal-plugin-mercury';
import '@webex/internal-plugin-presence';

import {assert} from '@webex/test-helper-chai';
import WebexCore from '@webex/webex-core';
import testUsers from '@webex/test-helper-test-users';
import {expectEvent} from '@webex/test-helper-mocha';
import sinon from 'sinon';

describe('plugin-presence', function () {
  this.timeout(10000);
  describe('Presence', () => {
    let mccoy, spock;

    beforeEach('create users', () =>
      testUsers.create({count: 2}).then((users) => {
        [spock, mccoy] = users;
        spock.webex = new WebexCore({
          credentials: {
            authorization: users[0].token,
          },
        });
        mccoy.webex = new WebexCore({
          credentials: {
            authorization: users[1].token,
          },
        });
      })
    );

    beforeEach('register with wdm', () =>
      Promise.all([spock.webex.internal.device.register(), mccoy.webex.internal.device.register()])
    );

    beforeEach('register spock with mercury', () => spock.webex.internal.mercury.connect());

    afterEach('deregister spock with mercury', () => spock.webex.internal.mercury.disconnect());

    describe('#enable()', () => {
      it('enables presence', () =>
        spock.webex.internal.presence
          .enable()
          .then((isEnabled) => {
            assert.equal(isEnabled, true);
          })
          .then(() => spock.webex.internal.presence.isEnabled())
          .then((isEnabled) => {
            assert.equal(isEnabled, true);
          }));
    });

    describe('#disable()', () => {
      it('disables presence', () =>
        spock.webex.internal.presence
          .disable()
          .then((isEnabled) => {
            assert.equal(isEnabled, false);
          })
          .then(() => spock.webex.internal.presence.isEnabled())
          .then((isEnabled) => {
            assert.equal(isEnabled, false);
          }));
    });

    describe('#isEnabled()', () => {
      it('returns true when presence is enabled', () =>
        spock.webex.internal.presence
          .enable()
          .then(() => spock.webex.internal.presence.isEnabled())
          .then((isEnabled) => {
            assert.equal(isEnabled, true);
          }));

      it('returns false when presence is disabled', () =>
        spock.webex.internal.presence
          .disable()
          .then(() => spock.webex.internal.presence.isEnabled())
          .then((isEnabled) => {
            assert.equal(isEnabled, false);
          }));
    });

    describe('#get()', () => {
      it("gets a person's status by id", () =>
        spock.webex.internal.presence.get(mccoy.id).then((presenceResponse) => {
          assert.property(presenceResponse, 'subject');
          assert.equal(presenceResponse.subject, mccoy.id);
        }));
    });

    describe('#list()', () => {
      it('returns an object with the status of all requested people', () =>
        spock.webex.internal.presence.list([mccoy.id, spock.id]).then((presenceResponse) => {
          assert.equal(presenceResponse.statusList.length, 2);
          assert.property(presenceResponse.statusList[0], 'subject');
          assert.equal(presenceResponse.statusList[0].subject, mccoy.id);
          assert.property(presenceResponse.statusList[1], 'subject');
          assert.equal(presenceResponse.statusList[1].subject, spock.id);
        }));

      describe('batching of presence requests', () => {
        let batchTestUsers;

        beforeEach('create more users', () =>
          testUsers.create({count: 6}).then((users) => {
            batchTestUsers = users;
          })
        );

        it('executes network requests for max limit', () => {
          spock.webex.internal.presence.config.batcherMaxCalls = 2;
          sinon.spy(spock.webex.internal.presence.batcher, 'submitHttpRequest');

          return spock.webex.internal.presence
            .list(batchTestUsers.map((user) => user.id))
            .then((presenceResponse) => {
              assert.equal(presenceResponse.statusList.length, 6);
              assert.calledThrice(spock.webex.internal.presence.batcher.submitHttpRequest);
              spock.webex.internal.presence.batcher.submitHttpRequest.restore();
            });
        });
      });
    });

    describe('#subscribe', () => {
      afterEach(
        () =>
          spock && spock.webex && spock.webex.internal.presence.unsubscribe([mccoy.id, spock.id])
      );

      it('subscribes to a person id and returns subscription status', () =>
        spock.webex.internal.presence.subscribe(mccoy.id).then((presenceResponse) => {
          assert.property(presenceResponse, 'responses');
          assert.equal(presenceResponse.responses.length, 1);
          assert.equal(presenceResponse.responses[0].subject, mccoy.id);
        }));

      it('subscribes and returns subscription status of a list of people ids', () =>
        spock.webex.internal.presence.subscribe([mccoy.id, spock.id]).then((presenceResponse) => {
          assert.property(presenceResponse, 'responses');
          assert.equal(presenceResponse.responses.length, 2);
          assert.equal(presenceResponse.responses[0].subject, mccoy.id);
          assert.equal(presenceResponse.responses[1].subject, spock.id);
        }));

      // Note: The presence service no longer accepts setting status to "inactive".
      // Inactivity is now determined by a "last active time" of greater than 10 minutes.
      it("should receive a mercury event for a subscribed person's change", () =>
        spock.webex.internal.presence
          .subscribe(mccoy.id)
          // 'active' status
          .then(() =>
            Promise.all([
              expectEvent(
                10000,
                'event:apheleia.subscription_update',
                spock.webex.internal.mercury,
                'spock should get the presence active event'
              ),
              mccoy.webex.internal.presence.setStatus('active', 1500),
            ])
          )
          .then(([event]) =>
            assert.equal(
              event.data.status,
              'active',
              'mccoy presence event status should be active'
            )
          )
          // 'dnd' status
          .then(() =>
            Promise.all([
              expectEvent(
                10000,
                'event:apheleia.subscription_update',
                spock.webex.internal.mercury,
                'spock should get the presence dnd event'
              ),
              mccoy.webex.internal.presence.setStatus('dnd', 1500),
            ])
          )
          .then(([event]) =>
            assert.equal(event.data.status, 'dnd', 'mccoy presence event status should be dnd')
          ));
    });

    describe('#unsubscribe', () => {
      it('unsubscribes to presence updates of a single person id', () =>
        spock.webex.internal.presence
          .unsubscribe(mccoy.id)
          .then((res) => assert.statusCode(res, 200)));

      it('unsubscribes to presence updates of a list of people ids', () =>
        spock.webex.internal.presence
          .unsubscribe([mccoy.id, spock.id])
          .then((res) => assert.statusCode(res, 200)));
    });

    describe('#setStatus', () => {
      it('sets the presence status of the current user', () =>
        spock.webex.internal.presence.setStatus('dnd', 1500).then((statusResponse) => {
          assert.property(statusResponse, 'subject');
          assert.property(statusResponse, 'status');
          assert.equal(statusResponse.subject, spock.id);
          assert.equal(statusResponse.status, 'dnd');
        }));
    });
  });
});
