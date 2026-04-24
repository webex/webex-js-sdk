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

  describe('Sharable MobiusSocket', () => {
    let mobiusSocket;
    let webex;

    beforeEach(() =>
      testUsers.create({count: 1}).then((users) => {
        webex = new WebexCore({
          credentials: {
            supertoken: users[0].token,
          },
        });

        mobiusSocket = getMobiusSocketInstance(webex);

        return webex.internal.device
          .register()
          .then(() => webex.internal.feature.setFeature('developer', 'web-shared-mobiusSocket', true));
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
    });

    it('emits shared registration status before authorization completes', () => {
      const bufferStateSpy = sinon.spy();
      const registrationStatusSpy = sinon.spy();

      mobiusSocket.on('event:mercury.buffer_state', bufferStateSpy);
      mobiusSocket.on('event:mobiusSocket.registration_status', registrationStatusSpy);

      return mobiusSocket.connect().then(() => {
        assert.notCalled(bufferStateSpy);
        assert.calledOnce(registrationStatusSpy);

        const {data} = registrationStatusSpy.args[0][0];

        assert.property(data, 'bufferState');
        assert.property(data, 'localClusterServiceUrls');
        assert.deepEqual(mobiusSocket.localClusterServiceUrls, data.localClusterServiceUrls);
      });
    });
  });
});
