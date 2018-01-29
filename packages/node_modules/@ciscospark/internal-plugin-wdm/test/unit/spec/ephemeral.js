/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@ciscospark/test-helper-chai';
import MockSpark from '@ciscospark/test-helper-mock-spark';
import sinon from '@ciscospark/test-helper-sinon';
import Device, {config} from '@ciscospark/internal-plugin-wdm';
import {cloneDeep} from 'lodash';
import lolex from 'lolex';
import {skipInBrowser} from '@ciscospark/test-helper-mocha';

function promiseTick(count) {
  let promise = Promise.resolve();
  while (count > 1) {
    promise = promise.then(() => promiseTick(1));
    count -= 1;
  }
  return promise;
}

describe('plugin-wdm', () => {
  describe('Device', () => {
    let device, spark;

    beforeEach(() => {
      spark = new MockSpark({
        children: {
          device: Device
        },
        config: cloneDeep(config)
      });

      device = spark.internal.device;

      assert.isFalse(spark.internal.device.config.ephemeral);
      assert.equal(spark.internal.device.config.ephemeralDeviceTTL, config.device.ephemeralDeviceTTL);
    });

    afterEach(() => device.unregister());

    let clock;

    beforeEach(() => {
      clock = lolex.install({now: Date.now()});
    });

    afterEach(() => {
      clock.uninstall();
    });

    describe('#register()', () => {
      it('does not included a ttl', () => spark.internal.device.register()
        .then(() => {
          const req = spark.request.args[0][0];
          assert.notProperty(req, 'uri', 'this request hits a service/resource pair, not a uri');
          assert.notProperty(req.body, 'ttl');
        }));
    });

    describe('#refresh()', () => {
      it('includes a ttl', () => {
        spark.internal.device.url = 'http://example.com/device/id';
        return spark.internal.device.refresh()
          .then(() => {
            const req = spark.request.args[0][0];
            assert.equal(req.uri, spark.internal.device.url);
            assert.notProperty(req.body, 'ttl');
          });
      });
    });

    describe('when ephemeral', () => {
      beforeEach(() => {
        spark.internal.device.config.ephemeral = true;
        assert.isTrue(spark.internal.device.config.ephemeral);
        assert.equal(spark.internal.device.config.ephemeralDeviceTTL, config.device.ephemeralDeviceTTL);
      });

      describe('#register()', () => {
        it('includes a ttl', () => spark.internal.device.register()
          .then(() => {
            const body = spark.request.args[0][0].body;
            assert.property(body, 'ttl');
            assert.equal(body.ttl, config.device.ephemeralDeviceTTL);
          }));

        // skipping due to an aparent incompatibility between lolex and all
        // browsers but chrome
        skipInBrowser(it)('periodically refreshes the device', () => {
          sinon.spy(spark.internal.device, 'refresh');
          spark.internal.device.register();
          return promiseTick(80)
            .then(() => {
              assert.notCalled(spark.internal.device.refresh);
              clock.tick(config.device.ephemeralDeviceTTL / 2 * 1000);
              assert.notCalled(spark.internal.device.refresh);
              return promiseTick(80);
            })
            .then(() => {
              clock.tick(60 * 1000);
              return promiseTick(80);
            })
            .then(() => {
              assert.calledOnce(spark.internal.device.refresh);
              return promiseTick(4);
            })
            .then(() => {
              clock.tick(config.device.ephemeralDeviceTTL / 2 * 1000);
              assert.calledOnce(spark.internal.device.refresh);
              clock.tick(60 * 1000);
              assert.calledTwice(spark.internal.device.refresh);
            });
        });
      });

      describe('#refresh()', () => {
        it('includes a ttl', () => {
          spark.internal.device.url = 'http://example.com/device/id';
          return spark.internal.device.refresh()
            .then(() => {
              const body = spark.request.args[0][0].body;
              assert.property(body, 'ttl');
              assert.equal(body.ttl, config.device.ephemeralDeviceTTL);
            });
        });
      });

      describe('#unregister()', () => {
        // skipping due to an aparent incompatibility between lolex and all
        // browsers but chrome
        skipInBrowser(it)('stops refreshing the device', () => {
          sinon.spy(spark.internal.device, 'refresh');
          spark.internal.device.register();
          return promiseTick(8)
            .then(() => {
              spark.internal.device.url = 'http://example.com/device/id';
              assert.notCalled(spark.internal.device.refresh);
              clock.tick(config.device.ephemeralDeviceTTL / 2 * 1000);
              assert.notCalled(spark.internal.device.refresh);
              clock.tick(60 * 1000);
              assert.calledOnce(spark.internal.device.refresh);
              spark.internal.device.unregister();
              // Reminder: for this to be a valid test, the number of ticks on
              // the next line must be at least as many ticks as are advanced in
              // the refresh test.
              return promiseTick(4);
            })
            .then(() => {
              clock.tick(config.device.ephemeralDeviceTTL / 2 * 1000);
              assert.calledOnce(spark.internal.device.refresh);
              clock.tick(60 * 1000);
              assert.calledOnce(spark.internal.device.refresh);
            });
        });
      });

      it('does not get persisted to bounded storage', () => {
        assert.isTrue(spark.internal.device.config.ephemeral);

        spark.internal.device.url = 'http://example.com/device/id';

        // single tick accounts for debounce
        clock.tick(1);
        assert.notProperty(spark.boundedStorage.data.Device, '@');
      });
    });

    it('gets persisted to bounded storage', () => {
      spark.internal.device.url = 'http://example.com/device/id';

      // single tick accounts for debounce
      clock.tick(1);
      assert.equal(spark.boundedStorage.data.Device['@'].url, spark.internal.device.url);
    });
  });
});
