/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
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
      var metrics;
      beforeEach(function() {
        var spark = new MockSpark({
          children: {
            device: Device,
            metrics: Metrics
          }
        });

        metrics = spark.metrics;

        sinon.stub(metrics.circonus, 'fetch');
        sinon.stub(metrics.splunk, 'fetch');
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
