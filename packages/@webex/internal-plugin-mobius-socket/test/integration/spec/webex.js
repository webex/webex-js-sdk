/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import '../../../src';

import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import WebexCore from '@webex/webex-core';
import testUsers from '@webex/test-helper-test-users';

describe('plugin-mobiusSocket', function () {
  this.timeout(30000);

  let webex;

  beforeEach('create users', () =>
    testUsers.create({count: 1}).then(async (users) => {
      // Pause for 5 seconds for CI
      await new Promise((done) => setTimeout(done, 5000));

      webex = new WebexCore({
        credentials: {
          supertoken: users[0].token,
        },
      });
      sinon.spy(webex.internal.mobiusSocket, 'disconnect');
      sinon.spy(webex.internal.device, 'unregister');

      return webex.internal.mobiusSocket.connect();
    })
  );

  describe('onBeforeLogout()', () => {
    it('disconnects the web socket', () => {
      webex.logout({noRedirect: true}).then(() => {
        assert.called(webex.internal.mobiusSocket.disconnect);
        assert.isFalse(webex.internal.mobiusSocket.connected);
        assert.called(webex.internal.device.unregister);
        assert.isFalse(webex.internal.device.registered);
      });
    });
  });
});
