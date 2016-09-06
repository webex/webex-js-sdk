/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@ciscospark/test-helper-chai';
import MockSpark from '@ciscospark/test-helper-mock-spark';
import sinon from '@ciscospark/test-helper-sinon';
import Device from '../..';
import deviceFixture from '../lib/device-fixture';

describe(`plugin-wdm`, () => {
  describe(`Device`, () => {
    let device;

    beforeEach(() => {
      const spark = new MockSpark({
        children: {
          device: Device
        }
      });

      spark.device.set(deviceFixture);

      device = spark.device;

      device.services = {};
      device.config.preDiscoveryServices = {};
    });

    describe(`#clear()`, () => {
      it(`does not remove \`logger\``, () => {
        assert.property(device, `logger`);
        assert.isDefined(device.logger);
        device.clear();
        assert.property(device, `logger`);
        assert.isDefined(device.logger);
      });

      it(`clears all features`, () => {
        assert.isAbove(device.features.developer.length, 0);
        device.clear();
        assert.lengthOf(device.features.developer, 0);
      });
    });

    describe(`#getPreDiscoveryServiceUrl()`, () => {
      it(`requires a \`service\` parameter`, () => {
        return assert.isRejected(device.getPreDiscoveryServiceUrl(), /`service` is a required parameter/);
      });

      it(`returns the specified hardcoded service url`, () => {
        device.config.preDiscoveryServices = {
          validServiceUrl: `http://example.com/pre-discovery-service`
        };

        return Promise.all([
          device.getPreDiscoveryServiceUrl(`invalid`)
            .then((url) => {
              assert.isUndefined(url);
            }),
          assert.becomes(device.getPreDiscoveryServiceUrl(`valid`), `http://example.com/pre-discovery-service`)
        ]);
      });
    });

    describe(`#getServiceUrl()`, () => {
      it(`requires a \`service\` parameter`, () => {
        return assert.isRejected(device.getServiceUrl(), /`service` is a required parameter/);
      });

      it(`returns the specified service url`, () => {
        device.services = {
          validServiceUrl: `http://example.com/valid-service`
        };

        return Promise.all([
          device.getServiceUrl(`invalid`)
            .then((url) => {
              assert.isUndefined(url);
            }),
          assert.becomes(device.getServiceUrl(`valid`), `http://example.com/valid-service`)
        ]);
      });
    });

    describe(`#isPreDiscoveryService()`, () => {
      it(`requires a \`service\` parameter`, () => {
        return assert.isRejected(device.isPreDiscoveryService(), /`service` is a required parameter/);
      });

      it(`indicates whether the specified service is one of the hardcoded app services`, () => {
        device.config.preDiscoveryServices = {
          validServiceUrl: `http://example.com/pre-discovery-service`
        };

        return Promise.all([
          assert.becomes(device.isPreDiscoveryService(`invalid`), false),
          assert.becomes(device.isPreDiscoveryService(`valid`), true)
        ]);
      });
    });

    describe(`#isPreDiscoveryServiceUrl()`, () => {
      it(`requires a \`url\` parameter`, () => {
        return assert.isRejected(device.isPreDiscoveryServiceUrl(), /`uri` is a required parameter/);
      });

      it(`indicates whether the specified url is one of the hardcoded app services`, () => {
        device.config.preDiscoveryServices = {
          validServiceUrl: `http://example.com/pre-discovery-service`
        };

        return Promise.all([
          assert.becomes(device.isPreDiscoveryServiceUrl(`http://example.com/disovered-service/some-endpoint`), false),
          assert.becomes(device.isPreDiscoveryServiceUrl(`http://example.com/pre-discovery-service/some-endpoint`), true)
        ]);
      });
    });

    describe(`#isService()`, () => {
      it(`requires a \`service\` parameter`, () => {
        return assert.isRejected(device.isService(), /`service` is a required parameter/);
      });

      it(`indicates whether the specified service is known to the device`, () => {
        device.services = {
          validServiceUrl: `http://example.com/valid-service`
        };
        return Promise.all([
          assert.becomes(device.isService(`invalid`), false),
          assert.becomes(device.isService(`valid`), true)
        ]);
      });
    });

    describe(`#isServiceUrl()`, () => {
      it(`requires a \`url\` parameter`, () => {
        return assert.isRejected(device.isServiceUrl(), /`uri` is a required parameter/);
      });

      it(`indicates whether the specified url is for a service known to the device`, () => {
        device.services = {
          validServiceUrl: `http://example.com/service`
        };
        return Promise.all([
          assert.becomes(device.isServiceUrl(`http://example.com/not-a-service/some-endpoint`), false),
          assert.becomes(device.isServiceUrl(`http://example.com/service/some-endpoint`), true)
        ]);
      });
    });

    describe(`#register()`, () => {
      describe(`when the device is already registered`, () => {
        it(`refreshes the device`, () => {
          sinon.spy(device, `refresh`);

          device.url = `http://example.com/device/1`;
          assert.isTrue(device.registered);

          assert.notCalled(device.refresh);
          return device.register()
            .then(() => assert.calledOnce(device.refresh));
        });
      });
    });

    describe(`#refresh()`, () => {
      describe(`when the device is not registered`, () => {
        it(`registers the device`, () => {
          sinon.spy(device, `register`);

          device.unset(`url`);


          assert.notCalled(device.register);
          return device.refresh()
            .then(() => assert.calledOnce(device.register));
        });
      });

      describe(`when the service responds with a 404`, () => {
        it(`registers the device`, () => {
          const newUrl = `http://example.com/device/2`;
          const request = device.spark.request;
          assert.isTrue(device.registered);
          request.onCall(0).returns(Promise.reject({statusCode: 404}));
          request.onCall(1).returns(Promise.resolve({body: {url: newUrl}}));
          return device.refresh()
            .then(() => {
              assert.equal(device.url, newUrl);
              assert.calledTwice(request);
            });
        });
      });
    });

    describe(`#serialize()`, () => {
      it(`serializes feature toggles in a format compatible with WDM`, () => {
        assert.deepEqual(device.serialize().features, deviceFixture.features);
      });
    });
  });
});
