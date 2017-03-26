/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var assert = require('chai').assert;
var SparkHttpError = require('../../../../../src/lib/exceptions/spark-http-error');

describe('SparkHttpError', function() {
  it('extracts an error message from a response body string', function() {
    var res = {
      body: 'error string',
      options: {
        headers: {},
        service: 'service',
        url: 'url'
      }
    };

    var error = new SparkHttpError(res);
    assert.equal(error.rawMessage, 'error string');
  });

  it('extracts an error message from a response body object', function() {
    var res = {
      body: {
        error: 'error string'
      },
      options: {
        headers: {},
        service: 'service',
        url: 'url'
      }
    };

    var error = new SparkHttpError(res);
    assert.equal(error.rawMessage, 'error string');
  });

  it('recursively extracts an error message from a response body object', function() {
    var res = {
      body: {
        error: {
          error: 'error string'
        }
      },
      options: {
        headers: {},
        service: 'service',
        url: 'url'
      }
    };

    var error = new SparkHttpError(res);
    assert.equal(error.rawMessage, 'error string');
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
      },
      options: {
        headers: {},
        service: 'service',
        url: 'url'
      }
    };

    var error = new SparkHttpError(res);
    assert.equal(error.rawMessage, 'error string');
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
      },
      options: {
        headers: {},
        service: 'service',
        url: 'url'
      }
    };

    var error = new SparkHttpError(res);
    assert.equal(error.rawMessage, 'error string');
  });

  it('falls back an empty message if no error string can be found', function() {
    var res = {
      body: '',
      options: {
        headers: {},
        service: 'service',
        url: 'url'
      }
    };

    var error = new SparkHttpError(res);
    /* eslint new-cap: [0] */
    assert.equal(error.rawMessage, '');
  });

  it('treats an entire response body as an error message if no likely error string candidate can be found', function() {
    var errorString = JSON.stringify({
      somethingBadHappend: 'the server broke'
    });

    var res = {
      body: errorString,
      options: {
        headers: {},
        service: 'service',
        url: 'url'
      }
    };

    var error = new SparkHttpError(res);
    assert.equal(error.rawMessage, errorString);
  });
});
