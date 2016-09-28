/**!
 *
 * Copyright (c) 2015 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@ciscospark/test-helper-chai';
import Metrics, {config} from '../..';
import MockSpark from '@ciscospark/test-helper-mock-spark';
import sinon from '@ciscospark/test-helper-sinon';

describe(`plugin-metrics`, () => {
  describe(`Metrics`, () => {
    let spark;

    beforeEach(() => {
      spark = new MockSpark({
        children: {
          metrics: Metrics
        }
      });

      spark.config.metrics = config.metrics;

      spark.request = function(options) {
        return Promise.resolve({
          statusCode: 204,
          body: undefined,
          options
        });
      };
      sinon.spy(spark, `request`);
    });

    describe(`#submit()`, () => {
      it(`submits a metric`, () => {
        return spark.metrics.submit(`testMetric`)
          .then(() => {
            assert.calledOnce(spark.request);
            const req = spark.request.args[0][0];
            const metric = req.body.metrics[0];

            assert.property(metric, `key`);
            assert.property(metric, `version`);
            assert.property(metric, `appType`);
            assert.property(metric, `env`);
            assert.property(metric, `time`);
            assert.property(metric, `version`);

            assert.equal(metric.key, `testMetric`);
            assert.equal(metric.version, spark.version);
            assert.equal(metric.env, `TEST`);
          });
      });
    });

    describe(`#submitClientMetrics()`, () => {
      it(`submits a metric to clientmetrics`, () => {
        const testPayload = {
          tags: {success: true},
          fields: {perceivedDurationInMillis: 314}
        };
        return spark.metrics.submitClientMetrics(`test`, testPayload)
          .then(() => {
            assert.calledOnce(spark.request);
            const req = spark.request.args[0][0];
            const metric = req.body.metrics[0];

            assert.property(metric, `metricName`);
            assert.property(metric, `tags`);
            assert.property(metric, `fields`);

            assert.equal(metric.metricName, `test`);
            assert.equal(metric.tags.success, true);
            assert.equal(metric.fields.perceivedDurationInMillis, 314);
          });
      });

    });
  });
});
