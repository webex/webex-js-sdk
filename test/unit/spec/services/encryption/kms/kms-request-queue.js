/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var KmsbatchedRequestQueue = require('../../../../../../src/client/services/encryption/kms/kms-request-queue');
var assert = require('chai').assert;

describe('Services', function() {
  describe('Encryption', function() {
    describe('KmsbatchedRequestQueue', function() {
      var client;
      var config;
      var queue;

      beforeEach(function() {
        client = {};
        config = {};
        queue = new KmsbatchedRequestQueue({
          client: client,
          config: config
        });
      });

      describe('#push()', function() {
        it('requires a `req` parameter', function() {
          assert.throws(function() {
            queue.push();
          }, /`req` is a required parameter/);
        });
      });

    });
  });
});
