/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var assert = require('chai').assert;
var HttpError = require('../../../../../src/lib/exceptions/http-error');
var SparkHttpError = require('../../../../../src/lib/exceptions/spark-http-error');
var SparkHttpErrors = require('../../../../../src/lib/exceptions/spark-http-errors');

describe('SparkHttpErrors', function() {
  describe('#select()', function() {
    it('selects the correct sub error based on status code', function() {
      var res = {
        statusCode: 401,
        options: {
          headers: {}
        }
      };

      var error = new (SparkHttpErrors.select(res.statusCode))(res);
      assert.instanceOf(error, Error);
      assert.instanceOf(error, HttpError);
      assert.instanceOf(error, SparkHttpError);
      assert.instanceOf(error, SparkHttpErrors.Unauthorized);
    });

    it('falls back to the generic SparkHttpError if no speific error can be determined', function() {
      var res = {
        statusCode: 499,
        options: {
          headers: {}
        }
      };

      var error = new (SparkHttpErrors.select(res))(res);
      assert.instanceOf(error, SparkHttpError);
    });
  });
});
