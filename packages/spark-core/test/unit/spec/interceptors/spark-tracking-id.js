/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@ciscospark/test-helper-chai';
import {SparkTrackingIdInterceptor} from '../../..';

describe(`spark-core`, () => {
  describe(`Interceptors`, () => {
    describe(`SparkTrackingIdInterceptor`, () => {
      let interceptor;
      beforeEach(() => {
        interceptor = Reflect.apply(SparkTrackingIdInterceptor.create, {
          sessionId: `mock-spark_uuid`
        }, []);
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
          assert.equal(options.headers.trackingid, `mock-spark_uuid_1`);
        });

        it(`does not add a tracking id if one is already specified`, () => {
          const options = {headers: {trackingid: `some id`}};
          interceptor.onRequest(options);

          assert.property(options, `headers`);
          assert.property(options.headers, `trackingid`);
          assert.equal(options.headers.trackingid, `some id`);

        });
      });

    });
  });
});
