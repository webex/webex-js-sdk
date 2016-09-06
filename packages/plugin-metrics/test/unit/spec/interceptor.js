/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@ciscospark/test-helper-chai';
import sinon from '@ciscospark/test-helper-sinon';
import {AutoInstrumentInterceptor} from '../..';

describe(`Metrics`, () => {
  describe(`Interceptor`, () => {
    let interceptor;
    let spark;
    beforeEach(() => {
      spark = {
        request: sinon.spy(),
        metrics: {
          submit: sinon.spy()
        }
      };
      interceptor = Reflect.apply(AutoInstrumentInterceptor.create, spark, []);
    });

    describe(`#onResponse()`, () => {
      it(`fires a metric for every network request`, () => {
        assert.notCalled(interceptor.spark.metrics.submit);
        const res = {};
        const options = {
          uri: `https://service.example.com`,
          shouldMeasure: true,
          $timings: {
            requestStart: 900,
            networkStart: 1000,
            networkEnd: 1040,
            requestnd: 1500
          }
        };
        interceptor.onResponse(options, res);
        assert.calledOnce(interceptor.spark.metrics.submit);
      });

      it(`does not go into a loop measuring its own metric requests`, () => {
        assert.notCalled(interceptor.spark.metrics.submit);
        const res = {};
        const options = {
          uri: `https://metrics.example.com`,
          shouldMeasure: false,
          $timings: {
            requestStart: 900,
            networkStart: 1000,
            networkEnd: 1040,
            requestnd: 1500
          }
        };
        interceptor.onResponse(options, res);
        assert.notCalled(interceptor.spark.metrics.submit);
      });
    });
  });
});
