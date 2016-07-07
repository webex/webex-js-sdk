/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var SplunkMetricsBatchedRequestQueue = require('../../../../../src/client/services/metrics/splunk-metrics-batched-request-queue');
var chai = require('chai');
var skipInBrowser = require('../../../../lib/mocha-helpers').skipInBrowser;

var assert = chai.assert;

describe('Services', function() {
  describe('Metrics', function() {
    describe('SplunkMetricsBatchedRequestQueue', function() {
      var client;
      var config;
      var queue;
      beforeEach(function() {
        client = {};
        config = {
          appVersion: 'version',
          appType: 'type'
        };

        queue = new SplunkMetricsBatchedRequestQueue({
          client: client,
          config: config
        });
      });

      describe('#push()', function() {
        var env;
        beforeEach(function() {
          env = process.env.NODE_ENV;
        });

        afterEach(function() {
          process.env.NODE_ENV = env;
        });

        it('requires a payload', function() {
          assert.throws(function() {
            queue.push();
          }, /`payload` is a required parameter/);
        });

        // Can't run in browsers because of envify
        skipInBrowser(it)('defaults to `development` for NODE_ENV', function() {
          delete process.env.NODE_ENV;

          var payload = {};
          queue.push(payload);
          assert.equal(payload.env, 'DEVELOPMENT');
        });

        it('assigns common payload data', function() {
          var payload = {};

          queue.push(payload);
          assert.equal(payload.env, process.env.NODE_ENV.toUpperCase());
          assert.isDefined(payload.time);
        });
      });

      describe('#toPayloads()', function() {
        beforeEach(function() {
          for (var i = 0; i < 15; i++) {
            queue.push({});
          }
        });

        it('assigns a postTime to each enqueued metric', function() {
          return queue.toPayloads()
            .then(function(payloads) {
              payloads.forEach(function(payload) {
                payload.forEach(function(item) {
                  assert.isDefined(item.postTime);
                });
              });
            });
        });

        it('empties the queue', function() {
          queue.toPayloads();
          assert.lengthOf(queue.queue, 0);
        });

        it('resolves with a (possibly) segmented set of request bodies', function() {
          return queue.toPayloads()
            .then(function(payloads) {
              assert.lengthOf(payloads, 1);
              assert.lengthOf(payloads[0], 15);
            });
        });
      });

    });
  });
});
