/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import FakeTimers from '@sinonjs/fake-timers';
import Metrics, {config} from '@webex/internal-plugin-metrics';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';
import {WebexHttpError} from '@webex/webex-core';

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
    let webex;

    beforeEach(() => {
      webex = new MockWebex({
        children: {
          metrics: Metrics
        }
      });

      webex.config.metrics = config.metrics;

      webex.request = function (options) {
        return Promise.resolve({
          statusCode: 204,
          body: undefined,
          options
        });
      };
      sinon.spy(webex, 'request');
    });

    let clock;

    beforeEach(() => {
      clock = FakeTimers.install();
    });

    afterEach(() => {
      clock.uninstall();
    });

    describe('#request()', () => {
      describe('when the request completes successfully', () => {
        it('clears the queue', () => {
          clock.uninstall();

          return webex.internal.metrics.clientMetricsBatcher.request({
            key: 'testMetric'
          })
            .then(() => {
              assert.calledOnce(webex.request);
              assert.lengthOf(webex.internal.metrics.clientMetricsBatcher.queue, 0);
            });
        });
      });

      describe('when the request fails due to network disconnect', () => {
        it('reenqueues the payload', () => {
          // sinon appears to have gap in its api where stub.onCall(n) doesn't
          // accept a function, so the following is more verbose than one might
          // desire
          webex.request = function () {
            // noop
          };
          let count = 0;

          sinon.stub(webex, 'request').callsFake((options) => {
            options.headers = {
              trackingid: count
            };

            count += 1;
            if (count < 9) {
              return Promise.reject(new WebexHttpError.NetworkOrCORSError({
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

          const promise = webex.internal.metrics.clientMetricsBatcher.request({
            key: 'testMetric'
          });

          return promiseTick(50)
            .then(() => assert.lengthOf(webex.internal.metrics.clientMetricsBatcher.queue, 1))
            .then(() => clock.tick(config.metrics.batcherWait))
            .then(() => assert.calledOnce(webex.request))

            .then(() => promiseTick(50))
            .then(() => clock.tick(1000))
            .then(() => promiseTick(50))
            .then(() => clock.tick(config.metrics.batcherWait))
            .then(() => assert.calledTwice(webex.request))

            .then(() => promiseTick(50))
            .then(() => clock.tick(2000))
            .then(() => promiseTick(50))
            .then(() => clock.tick(config.metrics.batcherWait))
            .then(() => assert.calledThrice(webex.request))

            .then(() => promiseTick(50))
            .then(() => clock.tick(4000))
            .then(() => promiseTick(50))
            .then(() => clock.tick(config.metrics.batcherWait))
            .then(() => assert.callCount(webex.request, 4))

            .then(() => promiseTick(50))
            .then(() => clock.tick(8000))
            .then(() => promiseTick(50))
            .then(() => clock.tick(config.metrics.batcherWait))
            .then(() => assert.callCount(webex.request, 5))

            .then(() => promiseTick(50))
            .then(() => clock.tick(16000))
            .then(() => promiseTick(50))
            .then(() => clock.tick(config.metrics.batcherWait))
            .then(() => assert.callCount(webex.request, 6))

            .then(() => promiseTick(50))
            .then(() => clock.tick(32000))
            .then(() => promiseTick(50))
            .then(() => clock.tick(config.metrics.batcherWait))
            .then(() => assert.callCount(webex.request, 7))

            .then(() => promiseTick(50))
            .then(() => clock.tick(32000))
            .then(() => promiseTick(50))
            .then(() => clock.tick(config.metrics.batcherWait))
            .then(() => assert.callCount(webex.request, 8))

            .then(() => promiseTick(50))
            .then(() => clock.tick(32000))
            .then(() => promiseTick(50))
            .then(() => clock.tick(config.metrics.batcherWait))
            .then(() => assert.callCount(webex.request, 9))

            .then(() => promiseTick(50))
            .then(() => assert.lengthOf(webex.internal.metrics.clientMetricsBatcher.queue, 0))
            .then(() => promise)
            .then(() => {
              assert.lengthOf(webex.request.args[1][0].body.metrics, 1, 'Reenqueuing the metric once did not increase the number of metrics to be submitted');
              assert.lengthOf(webex.request.args[2][0].body.metrics, 1, 'Reenqueuing the metric twice did not increase the number of metrics to be submitted');
              assert.lengthOf(webex.internal.metrics.clientMetricsBatcher.queue, 0);
            });
        });
      });
    });
  });
});
