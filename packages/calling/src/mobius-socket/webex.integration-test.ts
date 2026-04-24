/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import testUsers from '@webex/test-helper-test-users';
import WebexCore from '@webex/webex-core';
import sinon from 'sinon';

import {getMobiusSocketInstance, resetMobiusSocketInstance} from './index';

describe('mobius-socket', function () {
  this.timeout(30000);

  describe('Webex lifecycle', () => {
    let mobiusSocket;
    let webex;

    beforeEach(() =>
      testUsers.create({count: 1}).then(async (users) => {
        await new Promise((resolve) => setTimeout(resolve, 5000));

        webex = new WebexCore({
          credentials: {
            supertoken: users[0].token,
          },
        });

        mobiusSocket = getMobiusSocketInstance(webex);

        return mobiusSocket.connect();
      })
    );

    afterEach(async () => {
      if (mobiusSocket) {
        try {
          await mobiusSocket.disconnectAll();
        } catch (error) {
          // Ignore teardown failures from partially-open sockets in integration runs.
        }
      }

      resetMobiusSocketInstance();
    });

    it('disconnects the web socket when logout() is called', () => {
      sinon.spy(mobiusSocket, 'disconnectAll');

      return mobiusSocket.logout().then(() => {
        assert.called(mobiusSocket.disconnectAll);
        assert.isFalse(mobiusSocket.connected);
      });
    });
  });
});
