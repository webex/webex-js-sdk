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
  describe('Sharable MobiusSocket', () => {
    let webex;

    beforeEach(() =>
      testUsers.create({count: 1}).then((users) => {
        webex = new WebexCore({
          credentials: {
            supertoken: users[0].token,
          },
        });

        return webex.internal.device
          .register()
          .then(() => webex.internal.feature.setFeature('developer', 'web-shared-mobiusSocket', true));
      })
    );

    afterEach(() => webex && webex.internal.mobiusSocket.disconnect());

    describe('#connect()', () => {
      it('connects to mobiusSocket', () => webex.internal.mobiusSocket.connect());
    });

    it('emits messages that arrive before authorization completes', () => {
      const spy1 = sinon.spy();
      const spy2 = sinon.spy();

      webex.internal.mobiusSocket.on('event:mercury.buffer_state', spy1);
      webex.internal.mobiusSocket.on('event:mobiusSocket.registration_status', spy2);

      return webex.internal.mobiusSocket.connect().then(() => {
        assert.notCalled(spy1);
        assert.calledOnce(spy2);
        const {data} = spy2.args[0][0];

        assert.property(data, 'bufferState');
        assert.property(data, 'localClusterServiceUrls');

        assert.deepEqual(
          webex.internal.mobiusSocket.localClusterServiceUrls,
          data.localClusterServiceUrls
        );
      });
    });
  });
});
