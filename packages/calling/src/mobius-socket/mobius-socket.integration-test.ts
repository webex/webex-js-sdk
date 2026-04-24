/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import {flaky} from '@webex/test-helper-mocha';
import refreshCallback from '@webex/test-helper-refresh-callback';
import testUsers from '@webex/test-helper-test-users';
import WebexCore from '@webex/webex-core';
import sinon from 'sinon';

import {getMobiusSocketInstance, resetMobiusSocketInstance} from './index';

describe('mobius-socket', function () {
  this.timeout(30000);

  describe('MobiusSocket', () => {
    let mobiusSocket;
    let webex;

    beforeEach(() =>
      testUsers.create({count: 1}).then((users) => {
        webex = new WebexCore({
          credentials: {
            supertoken: users[0].token,
          },
          config: {
            credentials: {
              refreshCallback,
            },
          },
        });

        mobiusSocket = getMobiusSocketInstance(webex);
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

    describe('#connect()', () => {
      it('connects to mobius socket', () => mobiusSocket.connect());

      it('refreshes the access token when a 4401 is received', () =>
        webex.internal.device
          .register()
          .then(() => {
            // eslint-disable-next-line camelcase
            webex.credentials.supertoken.access_token = 'fake token';

            return mobiusSocket.connect();
          })
          .then(() =>
            // eslint-disable-next-line camelcase
            assert.notEqual(webex.credentials.supertoken.access_token, 'fake token')
          ));

      describe('when using an ephemeral device', () => {
        beforeEach(() => {
          webex.config.device.ephemeral = true;
        });

        it('connects to mobius socket', () => mobiusSocket.connect());
      });

      describe('when web-high-availability is enabled', () => {
        flaky(it, process.env.SKIP_FLAKY_TESTS)(
          'connects to mobius socket using service catalog url',
          () => {
            let defaultWebSocketUrl;

            return webex.internal.device
              .register()
              .then(() =>
                webex.internal.feature.setFeature('developer', 'web-high-availability', true)
              )
              .then(() => webex.internal.device.unregister())
              .then(() => webex.internal.device.register())
              .then(() => {
                defaultWebSocketUrl = webex.internal.device.webSocketUrl;
              })
              .then(() => mobiusSocket.connect())
              .then(() => webex.internal.device.getWebSocketUrl())
              .then((wsUrl) => {
                assert.notEqual(defaultWebSocketUrl, mobiusSocket.socket.url);
                assert.include(mobiusSocket.socket.url, wsUrl);
              });
          }
        );
      });
    });

    it('emits messages that arrive before authorization completes', () => {
      const spy = sinon.spy();

      mobiusSocket.on('event:mercury.buffer_state', spy);

      return mobiusSocket.connect().then(() => {
        assert.calledOnce(spy);
      });
    });
  });
});
