/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import '@ciscospark/internal-plugin-mercury';

import {assert} from '@ciscospark/test-helper-chai';
import sinon from '@ciscospark/test-helper-sinon';
import CiscoSpark from '@ciscospark/spark-core';
import testUsers from '@ciscospark/test-helper-test-users';
import refreshCallback from '@ciscospark/test-helper-refresh-callback';

describe('plugin-mercury', function () {
  this.timeout(30000);
  describe('Mercury', () => {
    let spark;

    beforeEach(() => testUsers.create({count: 1})
      .then((users) => {
        spark = new CiscoSpark({
          credentials: {
            supertoken: users[0].token
          },
          config: {
            credentials: {
              refreshCallback
            }
          }
        });
      }));

    afterEach(() => spark && spark.internal.mercury.disconnect());

    describe('#connect()', () => {
      it('connects to mercury', () => spark.internal.mercury.connect());

      it('refreshes the access token when a 4401 is received', () => spark.internal.device.register()
        .then(() => {
          // eslint-disable-next-line camelcase
          spark.credentials.supertoken.access_token = 'fake token';
          return spark.internal.mercury.connect();
        })
        // eslint-disable-next-line camelcase
        .then(() => assert.notEqual(spark.credentials.supertoken.access_token, 'fake token')));

      // This doesn't work as designed yet. The only way to get a 4404 is to try
      // to connect to someone else's valid registration; the intent was to get
      // a 4404 any time we try to connect to an invalid url. Actually, as it's
      // implemented, it should really be a 4403.
      // it(`refreshes the device when a 4404 is received`, () => spark.internal.device.register()
      //   .then(() => {
      //     const webSocketUrl = spark.internal.device.webSocketUrl;
      //     const wsu = spark.internal.device.webSocketUrl.split(`/`);
      //     wsu.reverse();
      //     wsu[1] = uuid.v4();
      //     wsu.reverse();
      //     spark.internal.device.webSocketUrl = wsu.join(`/`);
      //     return spark.internal.mercury.connect()
      //       .then(() => assert.notEqual(spark.internal.device.webSocketUrl, webSocketUrl));
      //   }));

      describe('when using an ephemeral device', () => {
        beforeEach(() => {
          spark.config.device.ephemeral = true;
        });

        it('connects to mercury', () => spark.internal.mercury.connect());
      });

      describe('when web-ha-messaging is enabled', () => {
        it('connects to mercury using service catalog url', () => {
          let defaultWebSocketUrl;

          // we need to ensure the feature is set for user before "registering"
          // the device
          return spark.internal.device.register()
            .then(() => spark.internal.feature.setFeature('developer', 'web-ha-messaging', true))
            .then(() => spark.internal.device.unregister())
            // start the test flow the device list
            .then(() => spark.internal.device.register())
            .then(() => {
              defaultWebSocketUrl = spark.internal.device.webSocketUrl;
            })
            .then(() => spark.internal.mercury.connect())
            .then(() => spark.internal.device.getWebSocketUrl())
            .then((wsUrl) => {
              assert.notEqual(defaultWebSocketUrl, spark.internal.mercury.socket.url);
              assert.include(spark.internal.mercury.socket.url, wsUrl);
            });
        });
      });
    });

    it('emits messages that arrive before authorization completes', () => {
      const spy = sinon.spy();
      spark.internal.mercury.on('event:mercury.buffer_state', spy);
      return spark.internal.mercury.connect()
        .then(() => {
          assert.calledOnce(spy);
        });
    });
  });
});
