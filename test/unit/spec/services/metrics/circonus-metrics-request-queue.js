/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var CirconusMetricsBatchedRequestQueue = require('../../../../../src/client/services/metrics/circonus-metrics-batched-request-queue');
var chai = require('chai');
var Device = require('../../../../../src/client/device');

var assert = chai.assert;

describe('Services', function() {
  describe('Metrics', function() {
    describe.skip('CirconusMetricsBatchedRequestQueue', function() {
      var client;
      var config;
      var queue;
      beforeEach(function() {
        client = {
          device: new Device({
            services: {
              conversationServiceUrl: 'http://example.com/conversation',
              locusServiceUrl: 'http://example.com/locus'
            }
          })
        };

        config = {};

        queue = new CirconusMetricsBatchedRequestQueue({
          client: client,
          config: config
        });
      });

      describe('#push()', function() {
        var env = process.env.NODE_ENV;
        afterEach(function() {
          process.env.NODE_ENV = env;
        });

        it('sets `env` to "TEST" if it is not production', function() {
          process.env.NODE_ENV = 'test';
          var payload = {
            key: 'locus.m1'
          };
          queue.push('locus', payload);
          assert.equal(payload.env, 'TEST');

          process.env.NODE_ENV = 'development';
          payload = {
            key: 'locus.m1'
          };
          queue.push('locus', payload);
          assert.equal(payload.env, 'TEST');
        });
      });

      describe('#toPayloads()', function() {
        it('resolves with a set of requests segmented by endpoint', function() {
          queue.push('conversation', {
            key: 'conversation.m1'
          });

          queue.push('conversation', {
            key: 'conversation.m2'
          });

          queue.push('locus', {
            key: 'locus.m2'
          });

          return queue.toPayloads()
            .then(function(payloads) {
              assert.lengthOf(payloads, 2);
              assert.equal(payloads[0].api, 'conversation');
              assert.lengthOf(payloads[0].queue, 2);
              assert.equal(payloads[1].api, 'locus');
              assert.lengthOf(payloads[1].queue, 1);
            });
        });
      });
    });
  });
});
