/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import makeLocalUrl from '@ciscospark/test-helper-make-local-url';
import {assert} from '@ciscospark/test-helper-chai';
import {defaults, HttpStatusInterceptor} from '@ciscospark/http-core';
import MockSpark from '@ciscospark/test-helper-mock-spark';
import Device, {EmbargoInterceptor} from '../../..';
import deviceFixture from '../../lib/device-fixture';
import sinon from '@ciscospark/test-helper-sinon';

describe(`plugin-wdm`, function() {
  // This isn't quite a unit test since we hit the local fixture server;
  // sometimes, sauce makes the fixture server a bit slow.
  this.timeout(30000);
  describe(`EmbargoInterceptor`, () => {
    let spark;

    beforeEach(() => {
      spark = new MockSpark({
        children: {
          device: Device
        }
      });

      spark.request = defaults({interceptors: [
        new EmbargoInterceptor({spark}),
        HttpStatusInterceptor.create()
      ]});

      sinon.spy(spark.device, `clear`);
      spark.credentials.clear = sinon.spy();
      spark.device.set(deviceFixture);

      spark.device.services = {};
      spark.device.config.preDiscoveryServices = {};
    });

    describe(`when it receives a 451`, () => {
      it(`bricks the client`, () => {
        return assert.isRejected(spark.request({uri: makeLocalUrl(`/embargoed`)}))
          .then((reason) => {
            assert.statusCode(reason, 451);
            assert.calledOnce(spark.device.clear);
          });
      });
    });
  });
});
