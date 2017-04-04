/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@ciscospark/test-helper-chai';
import {defaults, HttpStatusInterceptor} from '@ciscospark/http-core';
import Device, {DeviceUrlInterceptor} from '../../..';
import deviceFixture from '../../lib/device-fixture';
import MockSpark from '@ciscospark/test-helper-mock-spark';
import sinon from '@ciscospark/test-helper-sinon';

describe(`plugin-wdm`, () => {
  describe(`DeviceUrlInterceptor`, () => {

    let spark;
    beforeEach(() => {
      spark = new MockSpark({
        children: {
          device: Device
        }
      });

      spark.request = defaults({interceptors: [
        new DeviceUrlInterceptor({spark}),
        HttpStatusInterceptor.create()
      ]});

      sinon.spy(spark.device, `clear`);
      spark.credentials.clear = sinon.spy();
      spark.device.set(deviceFixture);

      spark.device.services = {};
      spark.device.config.preDiscoveryServices = {};
    });

    describe(`#onRequest()`, () => {
      it(`will not add Cisco-Device-URL in the request header for oauth service request`, () => {
        const options = {
          headers: {},
          service: `oauth`,
          uri: `http://www.example.com`
        };
        spark.request(options)
          .then((returnOptions) => {
            assert.isUndefined(returnOptions.headers[`Cisco-Device-URL`]);
          });
      });

      it(`will not add Cisco-Device-URL in the request header for saml service request`, () => {
        const options = {
          headers: {},
          service: `saml`,
          uri: `http://www.example.com`
        };
        spark.request(options)
          .then((returnOptions) => {
            assert.isUndefined(returnOptions.headers[`Cisco-Device-URL`]);
          });
      });

      it(`will add Cisco-Device-URL in the request header for aphelia service request`, () => {
        const options = {
          headers: {},
          service: `aphelia`,
          uri: `http://www.example.com`
        };
        spark.request(options)
          .then((returnOptions) => {
            assert.isDefined(returnOptions.headers[`Cisco-Device-URL`]);
          });
      });

    });
  });
});
