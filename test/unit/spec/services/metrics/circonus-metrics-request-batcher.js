/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var AbstractRequestBatcher = require('../../../../../src/lib/abstract-request-batcher.js');
var CirconusMetricsRequestBatcher = require('../../../../../src/client/services/metrics/circonus-metrics-request-batcher');
var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
var sinon = require('sinon');
var MockSpark = require('../../../lib/mock-spark');

var assert = chai.assert;
chai.use(chaiAsPromised);
sinon.assert.expose(chai.assert, {prefix: ''});

describe('Services', function() {
  describe('Metrics', function() {
    describe.skip('CirconusMetricsRequestBatcher', function() {
      var spark;
      var batcher;
      beforeEach(function() {
        spark = new MockSpark({
          children: {
            batcher: CirconusMetricsRequestBatcher
          }
        });

        batcher = spark.batcher;
      });

      describe('#fetch()', function() {
        var stub;
        beforeEach(function() {
          stub = sinon.stub(AbstractRequestBatcher.prototype, 'fetch');
        });

        afterEach(function() {
          stub.restore();
        });

        it('is only invoked if metrics are enabled', function(done) {
          spark.device.isValidService = sinon.stub().returns(true);

          batcher.config.enableMetrics = false;
          batcher.fetch();
          process.nextTick(function() {
            assert.notCalled(stub);

            batcher.config.enableMetrics = true;
            batcher.fetch({key: 'key'})
              .catch(done);
            setTimeout(function() {
              assert.called(stub);
              done();
            }, spark.config.metrics.bulkFetchDebounceDelay + 100);
          });
        });

      });

      describe('_checkParameters', function() {
        it('requires a payload', function() {
          spark.device.isValidService = sinon.stub().returns(true);
          return Promise.all([
            assert.isRejected(batcher._checkParameters(), /`payload` is a required parameter/),
            assert.isFulfilled(batcher._checkParameters({key: 'key'}))
          ]);
        });

        it('rejects if the desired metric does not appear to have an endpoint', function() {
          spark.device.isValidService = sinon.stub().returns(false);

          return assert.isRejected(batcher._checkParameters({key: 'metrics.m1'}), /metrics is not a known service. Please ensure your metric key begins with the service \(conversation, locus, etc\) that should recieve said metric\./);
        });
      });

    });
  });
});
