import '@webex/internal-plugin-device';

import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import WebexCore from '@webex/webex-core';
import testUsers from '@webex/test-helper-test-users';

describe('plugin-device', () => {
  describe('Webex', () => {
    let device;
    let user;
    let webex;

    before('create users', () => testUsers.create({count: 1})
      .then(([createdUser]) => {
        user = createdUser;
      }));

    beforeEach('create webex instance', () => {
      webex = new WebexCore({
        credentials: user.token
      });

      device = webex.internal.device;

      return device.register();
    });

    describe('#onBeforeLogout()', () => {
      beforeEach('setup spy', () => {
        sinon.spy(device, 'unregister');
      });

      it('unregisters the device', () =>
        webex.logout({noRedirect: true})
          .then(() => {
            assert.called(device.unregister);
            assert.isFalse(device.registered);
          }));
    });
  });
});
