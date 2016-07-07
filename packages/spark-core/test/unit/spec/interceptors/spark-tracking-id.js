/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@ciscospark/test-helper-chai';
import sinon from '@ciscospark/test-helper-sinon';
import {SparkTrackingIdInterceptor} from '../../..';

describe(`Interceptors`, () => {
  describe(`SparkTrackingIdInterceptor`, () => {
    let interceptor;
    beforeEach(() => {
      interceptor = SparkTrackingIdInterceptor.create({
        prefix: `spark-js-sdk--http-core`
      });
    });

    describe(`#create()`, () => {
      it(`requires an options object`, () => {
        assert.throws(() => {
          interceptor = SparkTrackingIdInterceptor.create();
        }, /`options.prefix` is required/);
      });

      it(`requires an prefix option`, () => {
        assert.throws(() => {
          interceptor = SparkTrackingIdInterceptor.create({});
        }, /`options.prefix` is required/);

        assert.doesNotThrow(() => {
          interceptor = SparkTrackingIdInterceptor.create({prefix: `spark-js-sdk--http-core`});
        }, /`options.prefix` is required/);
      });
    });

    describe(`#base`, () => {
      it(`may be specified via options`, () => {
        const interceptor = SparkTrackingIdInterceptor.create({
          base: `fake-base`,
          prefix: `spark-js-sdk--http-core`
        });

        assert.equal(interceptor.base, `fake-base`);
      });

      it(`defaults to a uuid`, () => {
        const pattern = /.{8}(?:-.{4}){3}-.{12}/;
        assert.match(interceptor.base, pattern);
      });

      it(`is not mutable`, () => {
        assert.throws(() => {
          interceptor.base = `this will throw`;
        });
      });
    });

    describe(`#prefix`, () => {
      it(`is not mutable`, () => {
        assert.throws(() => {
          interceptor.prefix = `this will throw`;
        });
      });
    });

    describe(`#sequence`, () => {
      it(`is an integer`, () => {
        assert.isNumber(interceptor.sequence);
      });

      it(`increases on every every access`, () => {
        const seq = interceptor.sequence;
        assert.equal(interceptor.sequence, seq + 1);
        assert.equal(interceptor.sequence, seq + 2);
        assert.equal(interceptor.sequence, seq + 3);
      });
    });

    describe(`#_generateTrackingId()`, () => {
      it(`returns a tracking id`, () => {
        const pattern = /spark-js-sdk--http-core_.{8}(?:-.{4}){3}-.{12}_\d+/;
        assert.match(interceptor._generateTrackingId(), pattern);
        assert.match(interceptor._generateTrackingId(), pattern);
        assert.match(interceptor._generateTrackingId(), pattern);
      });
    });

    describe(`#requiresTrackingId()`, () => {
      it(`defaults to true`, () => {
        assert.isTrue(interceptor.requiresTrackingId({headers: {}}));
      });

      it(`does not add a trackingid if one has already been added`, () => {
        assert.isFalse(interceptor.requiresTrackingId({
          headers: {
            trackingid: `some id`
          }
        }));
      });
    });

    describe(`#onRequest`, () => {
      it(`adds a tracking id`, () => {
        const options = {headers: {}};
        interceptor.onRequest(options);

        assert.property(options, `headers`);
        assert.property(options.headers, `trackingid`);
      });

      it(`does not add a tracking id if one is already specified`, () => {
        const spy = sinon.spy(interceptor, `_generateTrackingId`);
        interceptor.onRequest({
          headers: {
            trackingid: `some id`
          }
        });

        assert.notCalled(spy);
      });
    });

  });
});
