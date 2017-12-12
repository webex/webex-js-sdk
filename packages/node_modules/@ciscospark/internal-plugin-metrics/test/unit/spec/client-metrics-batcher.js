/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@ciscospark/test-helper-chai';
import lolex from 'lolex';
import Metrics, {config} from '@ciscospark/internal-plugin-metrics';
import MockSpark from '@ciscospark/test-helper-mock-spark';
import sinon from '@ciscospark/test-helper-sinon';
import {SparkHttpError} from '@ciscospark/spark-core';

function promiseTick(count) {
  let promise = Promise.resolve();
  while (count > 1) {
    promise = promise.then(() => promiseTick(1));
    count -= 1;
  }
  return promise;
}

describe('plugin-metrics', () => {
  describe('ClientMetricsBatcher', () => {
    let spark;

    beforeEach(() => {
      spark = new MockSpark({
        children: {
          metrics: Metrics
        }
      });

      spark.config.metrics = config.metrics;

      spark.request = function (options) {
        return Promise.resolve({
          statusCode: 204,
          body: undefined,
          options
        });
      };
      sinon.spy(spark, 'request');
    });

    let clock;
    beforeEach(() => {
      clock = lolex.install();
    });

    afterEach(() => {
      clock.uninstall();
    });

    describe('#request()', () => {
      describe('when the request completes successfully', () => {
        it('clears the queue', () => {
          clock.uninstall();
          return spark.internal.metrics.clientMetricsBatcher.request({
            key: 'testMetric'
          })
            .then(() => {
              assert.calledOnce(spark.request);
              assert.lengthOf(spark.internal.metrics.clientMetricsBatcher.queue, 0);
            });
        });
      });

      describe('when the request fails due to network disconnect', () => {
        it('reenqueues the payload', () => {
          // sinon appears to have gap in its api where stub.onCall(n) doesn't
          // accept a function, so the following is more verbose than one might
          // desire
          spark.request = function () {
            // noop
          };
          let count = 0;
          sinon.stub(spark, 'request').callsFake((options) => {
            options.headers = {
              trackingid: count
            };

            count += 1;
            if (count < 9) {
              return Promise.reject(new SparkHttpError.NetworkOrCORSError({
                statusCode: 0,
                options
              }));
            }

            return Promise.resolve({
              statusCode: 204,
              body: undefined,
              options
            });
          });

          const promise = spark.internal.metrics.clientMetricsBatcher.request({
            key: 'testMetric'
          });

          return promiseTick(50)
            .then(() => assert.lengthOf(spark.internal.metrics.clientMetricsBatcher.queue, 1))
            .then(() => clock.tick(config.metrics.batcherWait))
            .then(() => assert.calledOnce(spark.request))

            .then(() => promiseTick(50))
            .then(() => clock.tick(1000))
            .then(() => promiseTick(50))
            .then(() => clock.tick(config.metrics.batcherWait))
            .then(() => assert.calledTwice(spark.request))

            .then(() => promiseTick(50))
            .then(() => clock.tick(2000))
            .then(() => promiseTick(50))
            .then(() => clock.tick(config.metrics.batcherWait))
            .then(() => assert.calledThrice(spark.request))

            .then(() => promiseTick(50))
            .then(() => clock.tick(4000))
            .then(() => promiseTick(50))
            .then(() => clock.tick(config.metrics.batcherWait))
            .then(() => assert.callCount(spark.request, 4))

            .then(() => promiseTick(50))
            .then(() => clock.tick(8000))
            .then(() => promiseTick(50))
            .then(() => clock.tick(config.metrics.batcherWait))
            .then(() => assert.callCount(spark.request, 5))

            .then(() => promiseTick(50))
            .then(() => clock.tick(16000))
            .then(() => promiseTick(50))
            .then(() => clock.tick(config.metrics.batcherWait))
            .then(() => assert.callCount(spark.request, 6))

            .then(() => promiseTick(50))
            .then(() => clock.tick(32000))
            .then(() => promiseTick(50))
            .then(() => clock.tick(config.metrics.batcherWait))
            .then(() => assert.callCount(spark.request, 7))

            .then(() => promiseTick(50))
            .then(() => clock.tick(32000))
            .then(() => promiseTick(50))
            .then(() => clock.tick(config.metrics.batcherWait))
            .then(() => assert.callCount(spark.request, 8))

            .then(() => promiseTick(50))
            .then(() => clock.tick(32000))
            .then(() => promiseTick(50))
            .then(() => clock.tick(config.metrics.batcherWait))
            .then(() => assert.callCount(spark.request, 9))

            .then(() => promiseTick(50))
            .then(() => assert.lengthOf(spark.internal.metrics.clientMetricsBatcher.queue, 0))
            .then(() => promise)
            .then(() => {
              assert.lengthOf(spark.request.args[1][0].body.metrics, 1, 'Reenqueuing the metric once did not increase the number of metrics to be submitted');
              assert.lengthOf(spark.request.args[2][0].body.metrics, 1, 'Reenqueuing the metric twice did not increase the number of metrics to be submitted');
              assert.lengthOf(spark.internal.metrics.clientMetricsBatcher.queue, 0);
            });
        });
      });
    });
  });
});
