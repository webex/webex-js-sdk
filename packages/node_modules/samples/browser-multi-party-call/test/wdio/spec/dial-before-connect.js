/* eslint-disable no-warning-comments */

import '@ciscospark/plugin-phone';

import CiscoSpark from '@ciscospark/spark-core';
import testUsers from '@ciscospark/test-helper-test-users';

describe('sample-browser-multi-party-call', () => {
  describe('dial before connecting', () => {
    let mccoy, roomId, spock;

    const browserSpock = browser.select('browserSpock');
    const browserMccoy = browser.select('browserMccoy');

    before('reload browser', () => {
      browser.select('browserSpock').reload();
      browser.select('browserMccoy').reload();
    });

    before('create test users', () => testUsers.create({count: 2})
      .then((users) => {
        [spock, mccoy] = users;

        spock.spark = new CiscoSpark({
          credentials: {
            authorization: spock.token
          }
        });

        return spock.spark.phone.register();
      }));

    before('create test room and add members to room', () => spock.spark.request({
      method: 'POST',
      service: 'hydra',
      resource: 'rooms',
      body: {
        title: 'Call Test'
      }
    })
      .then((res) => {
        const room = res.body;

        roomId = room.id;

        return spock.spark.request({
          method: 'POST',
          service: 'hydra',
          resource: 'memberships',
          body: {
            roomId: room.id,
            personId: mccoy.id
          }
        });
      })
      .then(() => spock.spark.phone.deregister()));

    it('loads the app', () => {
      browser.url('/browser-multi-party-call/');
    });

    it('places call from spock to mccoy', () => {
      browserSpock.assertTitle('Sample: Multi Party Calling');
      browserSpock.setValueInDOM('[placeholder="Your access token"]', spock.token.access_token);
      browserSpock.setValue('[name="invitee"]', roomId);
      browserSpock.click('[title="dial"]');

      browserSpock.waitForExist('.listening');
    });

    it('connects mccoy\'s browser', () => {
      browserMccoy.assertTitle('Sample: Multi Party Calling');
      browserMccoy.setValueInDOM('[placeholder="Your access token"]', mccoy.token.access_token);
      browserMccoy.click('[title="connect"]');

      browserMccoy.acceptAlert(20000);
    });

    it('ends the call', () => {
      browser.pause(5000);
      // TODO add assertions around streams

      browserSpock.click('[title="hangup"]');
      browserMccoy.click('[title="hangup"]');
    });
  });
});
