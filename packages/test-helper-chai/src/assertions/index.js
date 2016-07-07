/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var file = require('@ciscospark/test-helper-file');
var schemas = require('./schemas');
var primitives = require('./primitives');

/**
 * @param {Object} chai
 * @returns {undefined}
 */
module.exports = function registerAssertions(chai) {
  var Assertion = chai.Assertion;

  /* eslint no-unused-expressions: [0] */

  Assertion.addMethod('statusCode', function expectStatusCode(statusCode) {
    this.assert(
      (this._obj.statusCode || this._obj) === statusCode,
      'expected #{this} to have an HTTP Status Code of ' + statusCode,
      'expected #{this} to not have an HTTP Status Code of ' + statusCode
    );
  });

  chai.assert.statusCode = function assertStatusCode(obj, statusCode, msg) {
    new Assertion(obj, msg).to.have.statusCode(statusCode);
  };

  Assertion.addProperty('blobLike', function blobLike() {
    this.assert(
      file.isBlobLike(this._obj),
      'expected #{this} to be a Buffer (nodejs) or Blob (browser)',
      'expected #{this} not to be a Buffer (nodejs) or Blob (browser)'
    );
  });

  Assertion.addProperty('bufferLike', function bufferLike() {
    this.assert(
      file.isBufferLike(this._obj),
      'expected #{this} to be a Buffer (nodejs) or ArrayBuffer (browser)',
      'expected #{this} not to be a Buffer (nodejs) or ArrayBuffer (browser)'
    );
  });

  chai.assert.isBlobLike = function isBlobLike(obj, msg) {
    new Assertion(obj, msg).to.be.blobLike;
  };

  chai.assert.isNotBlobLike = function isNotBlobLike(obj, msg) {
    new Assertion(obj, msg).not.to.be.blobLike;
  };

  chai.assert.isBufferLike = function isBufferLike(obj, msg) {
    new Assertion(obj, msg).to.be.bufferLike;
  };

  chai.assert.isNotBufferLike = function isNotBufferLike(obj, msg) {
    new Assertion(obj, msg).not.to.be.bufferLike;
  };

  primitives(chai);
  schemas(chai);
};
