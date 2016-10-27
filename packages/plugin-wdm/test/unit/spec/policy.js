/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@ciscospark/test-helper-chai';
import MockSpark from '@ciscospark/test-helper-mock-spark';
import Device from '../..';
import deviceFixture from '../lib/device-fixture';
import lolex from 'lolex';
import {cloneDeep} from 'lodash';

describe(`plugin-wdm`, () => {
  describe(`Device`, () => {
    let spark;
    beforeEach(() => {
      spark = new MockSpark({
        children: {
          device: Device
        }
      });

      spark.device.set(cloneDeep(deviceFixture));
    });

    let clock;

    beforeEach(() => {
      clock = lolex.install(Date.now());
    });

    afterEach(() => {
      clock.uninstall();
    });

    describe(`autologout policy`, () => {
      describe(`when some or all of the policy configuration is unspecified`, () => {
        it(`stays dormant`, () => {
          assert.isUndefined(spark.device.logoutTimer);

          spark.device.intranetInactivityCheckUrl = `http://ping.example.com/ping`;
          assert.isUndefined(spark.device.logoutTimer);

          spark.device.intranetInactivityDuration = 2;
          assert.isDefined(spark.device.logoutTimer);

          spark.device.unset(`intranetInactivityCheckUrl`);
          assert.isUndefined(spark.device.logoutTimer);
        });
      });

      describe(`when the policy configuration is specified`, () => {
        it(`logs the user out according to the policy configuration`, () => {
          spark.request.returns(Promise.reject());

          spark.device.set({
            intranetInactivityDuration: 8 * 60 * 60,
            intranetInactivityCheckUrl: `http://ping.example.com/ping`
          });
          assert.isDefined(spark.device.logoutTimer);

          clock.tick(8 * 60 * 60 * 1000);
          assert.calledOnce(spark.request);
          assert.calledWith(spark.request, {
            method: `GET`,
            uri: `http://ping.example.com/ping`
          });
          return Promise.resolve(() => assert.calledOnce(spark.logout));
        });

        describe(`when there is user activity`, () => {
          it(`resets the logout timer`, () => {
            spark.device.set({
              intranetInactivityDuration: 8 * 60 * 60,
              intranetInactivityCheckUrl: `http://ping.example.com/ping`
            });

            clock.tick(1 * 60 * 60 * 1000);
            spark.emit(`user-activity`);

            clock.tick(7 * 60 * 60 * 1000);
            assert.neverCalledWith(spark.request, {
              method: `GET`,
              uri: `http://ping.example.com/ping`
            });

            clock.tick(1 * 60 * 60 * 1000);
            assert.calledWith(spark.request, {
              method: `GET`,
              uri: `http://ping.example.com/ping`
            });
          });
        });
      });
    });
  });
});
