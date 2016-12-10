/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var base64 = require('../../../common').base64;
var shouldToAssert = require('./should-to-assert');

/**
 * @param {Object} chai
 * @returns {undefined}
 */
module.exports = function primitives(chai) {
  var Assertion = chai.Assertion;
  var assert = chai.assert;

  /* eslint no-unused-expressions: [0] */

  var uuidPattern = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/;
  var emailPattern = /^[^\s]+?@[^\s]+?$/;

  // This may need to be loosened in the future
  var hydraIdPattern = /^ciscospark:\/\/[a-zA-Z]+\/[a-zA-Z]+\/[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}(:[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12})?$/;

  Assertion.addProperty('hydraId', function() {
    assert.isString(this._obj);
    assert.notMatch(this._obj, uuidPattern);

    var decoded = base64.decode(this._obj);
    assert.match(decoded, hydraIdPattern);

  });

  Assertion.addProperty('uuid', function() {
    assert.isString(this._obj);
    assert.match(this._obj, uuidPattern);
  });

  Assertion.addProperty('email', function() {
    assert.isString(this._obj);
    assert.match(this._obj, emailPattern);
  });

  Assertion.addProperty('isoDate', function() {
    assert.isString(this._obj);
    assert.isNotNumber(this._obj);
    assert.notEqual(parseInt(this._obj, 10).toString(), this._obj);
  });

  Assertion.addMethod('properties', function(properties) {
    properties.forEach(function(property) {
      assert.property(this._obj, property);
    }.bind(this));
  });

  chai.assert.properties = function(obj, properties, msg) {
    new Assertion(obj, msg).to.have.properties(properties);
  };

  Assertion.addMethod('strictProperties', function(properties) {
    properties.forEach(function(property) {
      assert.property(this._obj, property);
    }.bind(this));

    assert.deepEqual(Object.keys(this._obj).sort(), properties.sort());
  });

  chai.assert.strictProperties = function(obj, properties, msg) {
    new Assertion(obj, msg).to.have.strictProperties(properties);
  };

  shouldToAssert(chai, {
    hydraId: 'isHydraID',
    uuid: 'isUUID',
    email: 'isEmail',
    isoDate: 'isISODate'
  });
};
