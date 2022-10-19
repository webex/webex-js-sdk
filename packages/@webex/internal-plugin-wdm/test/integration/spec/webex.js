/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/internal-plugin-wdm';

import {assert} from '@webex/test-helper-chai';
import WebexCore from '@webex/webex-core';
import testUsers from '@webex/test-helper-test-users';

describe('plugin-wdm', () => {
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
    });

    describe('when the plugin is imported', () => {
      it('should define a \'device\' plugin', () =>
        assert.isDefined(device));

      it('should contain all common device method members', () => {
        assert.isFunction(device.checkNetworkReachability);
        assert.isFunction(device.clear);
        assert.isFunction(device.getWebSocketUrl);
        assert.isFunction(device.meetingEnded);
        assert.isFunction(device.meetingStarted);
        assert.isFunction(device.processRegistrationSuccess);
        assert.isFunction(device.resetLogoutTimer);
        assert.isFunction(device.setLogoutTimer);
        assert.isFunction(device.refresh);
        assert.isFunction(device.register);
        assert.isFunction(device.unregister);
      });
    });
  });
});
