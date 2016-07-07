/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var AbstractRequestBatcher = require('../../../../../src/lib/abstract-request-batcher.js');
var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
// var Device = require('../../../../../src/client/device');
var MockSpark = require('../../../lib/mock-spark');
var sinon = require('sinon');
var SplunkMetricsRequestBatcher = require('../../../../../src/client/services/metrics/splunk-metrics-request-batcher');

var assert = chai.assert;
chai.use(chaiAsPromised);
sinon.assert.expose(chai.assert, {prefix: ''});

describe('Services', function() {
  describe('Metrics', function() {
    describe('SplunkMetricsRequestBatcher', function() {
      var batcher;
      beforeEach(function() {
        var spark = new MockSpark({
          children: {
            batcher: SplunkMetricsRequestBatcher
          }
        });

        batcher = spark.batcher;
        batcher.namespace = 'metrics';

        spark.config = {
          metrics: {
            enableMetrics: true,
            appVersion: 1,
            appType: 'app'
          }
        };
      });

      describe('#fetch', function() {
        var stub;
        beforeEach(function() {
          stub = sinon.stub(AbstractRequestBatcher.prototype, 'fetch').returns(Promise.resolve());
        });

        afterEach(function() {
          stub.restore();
        });

        it('is only invoked if metrics are enabled', function() {
          batcher.config.enableMetrics = false;
          batcher.fetch();
          assert.notCalled(stub);

          batcher.config.enableMetrics = true;
          batcher.fetch();
          assert.called(stub);
        });

        it('assigns common payload data that is not accessible to the queue', function() {
          var payload = {};
          return batcher.fetch(payload)
            .then(function() {
              assert.property(payload, 'version');
              assert.property(payload, 'appType');
            });
        });
      });

      describe('_checkParameters', function() {
        it('requires a payload', function() {
          return Promise.all([
            assert.isRejected(batcher._checkParameters(), /`payload` is a required parameter/),
            assert.isFulfilled(batcher._checkParameters({}))
          ]);
        });
      });

    });
  });
});
