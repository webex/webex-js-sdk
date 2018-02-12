/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import '@ciscospark/plugin-phone';

import CiscoSpark from '@ciscospark/spark-core';
import testUsers from '@ciscospark/test-helper-test-users';
import {browserOnly, handleErrorEvent} from '@ciscospark/test-helper-mocha';

import CMR from '../lib/cmr';
import {expectMembershipConnectedEvent} from '../lib/event-expectations';

if (process.env.NODE_ENV !== 'test') {
  throw new Error('Cannot run the plugin-phone test suite without NODE_ENV === "test"');
}

browserOnly(describe)('plugin-phone', function () {
  this.timeout(60000);

  describe('Call', () => {
    const users = {
      spock: null
    };
    let spock;

    before('create users and register', () => testUsers.create({count: Object.keys(users).length})
      .then((created) => Promise.all(Object.keys(users).map((name, index) => {
        users[name] = created[index];
        const user = users[name];
        user.spark = new CiscoSpark({
          credentials: {
            authorization: user.token
          }
        });

        return user.spark.phone.register();
      })))
      .then(() => {
        ({spock} = users);
      }));


    after('unregister users', () => Promise.all(Object.keys(users).map((name) => {
      const user = users[name];
      return user && user.spark.phone.deregister()
        // eslint-disable-next-line no-console
        .catch((reason) => console.warn(`could not unregister ${user}`, reason));
    })));

    describe('#sendDtmf()', () => {
      let cmr;
      beforeEach('reserve cmr', () => CMR.reserve(spock.spark)
        .then((c) => {
          cmr = c;
        }));

      afterEach('release cmr', () => cmr && cmr.release()
        // eslint-disable-next-line no-console
        .catch((err) => console.warn('failed to release CMR', err)));

      it('sends the tones required to join a CMR bridge', () => handleErrorEvent(spock.spark.phone.dial(cmr.sipAddress), (call) => expectMembershipConnectedEvent(call)
        .then(() => Promise.all([
          // Unfortunately, this delay seems to be required to deal with the
          // webex start up delay. I don't believe there's any specific event
          // to wait for
          (new Promise((resolve) => setTimeout(resolve, 3000)))
            .then(() => call.sendDtmf(`${cmr.responseMetaData.hostPin}#`)),
          cmr.waitForHostToJoin()
        ]))
        .then(() => call.hangup())));
    });
  });
});
