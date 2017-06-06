/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var Device = require('../../../../../src/client/device');
var Metrics = require('../../../../../src/client/services/metrics/metrics');
var MockSpark = require('../../../lib/mock-spark');
var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
var sinon = require('sinon');

var assert = chai.assert;
chai.use(chaiAsPromised);
sinon.assert.expose(chai.assert, {prefix: ''});

describe('Services', function() {
  describe('Metrics', function() {
    describe('Metrics', function() {
      var spark;
      var metrics;
      var eventName = 'test_event';
      var mockPayload = {
        fields: {
          testField: 123
        },
        tags: {
          testTag: 'tag value'
        },
        metricName: eventName,
        test: 'this field should not be included in final payload',
        type: 'behavioral'
      };
      var transformedProps = {
        fields: {
          testField: 123
        },
        tags: {
          testTag: 'tag value'
        },
        metricName: eventName,
        type: 'behavioral'
      };
      var preLoginId = '1b90cf5e-27a6-41aa-a208-1f6eb6b9e6b6';
      var preLoginProps = {
        metrics: [
          transformedProps
        ]
      };

      beforeEach(function() {
        spark = new MockSpark({
          children: {
            device: Device,
            metrics: Metrics
          }
        });

        spark.request = function(options) {
          return Promise.resolve({
            statusCode: 204,
            body: undefined,
            options: options
          });
        };

        metrics = spark.metrics;

        sinon.stub(metrics.circonus, 'fetch');
        sinon.stub(metrics.splunk, 'fetch');
        sinon.stub(metrics.clientMetrics, 'fetch');
        sinon.spy(metrics, 'postPreLoginMetric');
        sinon.spy(metrics, 'aliasUser');
        sinon.spy(spark, 'request');
      });

      describe('#sendUnstructured()', function() {
        it('enqueues a metric fetch', function() {
          metrics.sendUnstructured('key', 'value');
          assert.calledWith(metrics.splunk.fetch, {
            key: 'key',
            value: 'value'
          });
        });
      });

      describe('#sendSemiStructured()', function(){
        describe('before login', function() {
          it('posts pre-login metric', function() {
            metrics.sendSemiStructured(eventName, mockPayload, preLoginId);
            assert.calledWith(metrics.postPreLoginMetric, preLoginProps, preLoginId);
          });
        });
        describe('after login', function() {
          it('enqueues a clientMetrics fetch', function() {
            metrics.sendSemiStructured(eventName, mockPayload);
            assert.calledWith(metrics.clientMetrics.fetch, transformedProps);
          });
        });
      });

      describe('#postPreLoginMetric()', function() {
        it('returns an HttpResponse object', function() {
          return metrics.postPreLoginMetric(preLoginProps, preLoginId)
            .then(function() {
              assert.calledOnce(spark.request);
              var req = spark.request.args[0][0];
              var metric = req.body.metrics[0];
              var headers = req.headers;

              assert.property(headers, 'x-prelogin-userid');
              assert.property(metric, 'metricName');
              assert.property(metric, 'tags');
              assert.property(metric, 'fields');

              assert.equal(metric.metricName, eventName);
              assert.equal(metric.tags.testTag, 'tag value');
              assert.equal(metric.fields.testField, 123);
            });
        });
      });

      describe('#aliasUser()', function() {
        it('returns an HttpResponse object', function() {
          return metrics.aliasUser(preLoginId)
            .then(function() {
              assert.calledOnce(spark.request);
              var req = spark.request.args[0][0];
              var params = req.qs;

              sinon.match(params, {alias: true});
            });
        });
      });

      describe('#incrementCounter()', function() {
        it('enqueues a metric fetch', function() {
          metrics.incrementCounter('key');
          assert.calledWith(metrics.circonus.fetch, {
            key: 'key',
            type: 'INCREMENT'
          });
        });
      });

      describe('#decrementCounter()', function() {
        it('enqueues a metric fetch', function() {
          metrics.decrementCounter('key');
          assert.calledWith(metrics.circonus.fetch, {
            key: 'key',
            type: 'DECREMENT'
          });
        });
      });

      describe('#sendGauge()', function() {
        it('enqueues a metric fetch', function() {
          metrics.sendGauge('key', 5);
          assert.calledWith(metrics.circonus.fetch, {
            key: 'key',
            type: 'GAUGE',
            item: 5
          });
        });
      });

      describe('#sendTimer()', function() {
        it('enqueues a metric fetch', function() {
          metrics.sendTimer('key', 20);
          assert.calledWith(metrics.circonus.fetch, {
            key: 'key',
            type: 'MSECS',
            value: 20
          });
        });
      });

    });
  });
});
