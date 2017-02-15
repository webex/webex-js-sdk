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
    assert.equal(error.rawDescription, 'error string');
  });

  it('extracts an error message from a response body object', function() {
    var res = {
      body: {
        error: 'error string'
      }
    };

    var error = new HttpError(res);
    assert.equal(error.message, 'error string');
    assert.equal(error.rawDescription, 'error string');
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
    assert.equal(error.rawDescription, 'error string');
  });

  it('extracts an error message from a response body object that has an array', function() {
    var res = {
      body: {
        Errors: [
          {
            code: 10001,
            description: 'error string'
          }
        ]
      }
    };

    var error = new HttpError(res);
    assert.equal(error.message, JSON.stringify(res.body.Errors));
    assert.equal(error.rawDescription, 'error string');
  });

  it('recursively extracts an error message from a response body object that has an array', function() {
    var res = {
      body: {
        error: {
          message: [
            {
              code: 10001,
              description: 'error string'
            }
          ]
        }
      }
    };

    var error = new HttpError(res);
    assert.equal(error.message, JSON.stringify(res.body.error.message));
    assert.equal(error.rawDescription, 'error string');
  });

  it('falls back a a default message if no error string can be found', function() {
    var res = {
      body: ''
    };

    var error = new HttpError(res);
    /* eslint new-cap: [0] */
    assert.equal(error.message, HttpError().defaultMessage);
    assert.equal(error.rawDescription, HttpError().defaultRawDescription);
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
    assert.equal(error.rawDescription, errorString);
  });
});
