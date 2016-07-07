/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var assert = require('chai').assert;
var HttpError = require('../../../../../src/lib/exceptions/http-error');

describe('HttpError', function() {
  it('extracts an error message from a response body string', function() {
    var res = {
      body: 'error string'
    };

    var error = new HttpError(res);
    assert.equal(error.message, 'error string');
  });

  it('extracts an error message from a response body object', function() {
    var res = {
      body: {
        error: 'error string'
      }
    };

    var error = new HttpError(res);
    assert.equal(error.message, 'error string');
  });

  it('recursively extracts an error message from a response body object', function() {
    var res = {
      body: {
        error: {
          error: 'error string'
        }
      }
    };

    var error = new HttpError(res);
    assert.equal(error.message, 'error string');
  });

  it('falls back a a default message if no error string can be found', function() {
    var res = {
      body: ''
    };

    var error = new HttpError(res);
    /* eslint new-cap: [0] */
    assert.equal(error.message, HttpError().defaultMessage);
  });

  it('treats an entire response body as an error message if no likely error string candidate can be found', function() {
    var errorString = JSON.stringify({
      somethingBadHappend: 'the server broke'
    });

    var res = {
      body: errorString
    };

    var error = new HttpError(res);
    assert.equal(error.message, errorString);
  });
});
