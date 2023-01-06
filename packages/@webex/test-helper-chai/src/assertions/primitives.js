/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-disable no-invalid-this */
/* eslint-disable func-names */

const shouldToAssert = require('./should-to-assert');

/**
 * @param {Object} chai
 * @returns {undefined}
 */
module.exports = function (chai) {
  const {Assertion, assert} = chai;

  /* eslint no-unused-expressions: [0] */

  const uuidPattern = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/;
  const emailPattern = /^[^\s]+?@[^\s]+?$/;

  Assertion.addProperty('hydraId', function () {
    assert.isString(this._obj);
    assert.notMatch(this._obj, uuidPattern);
  });

  Assertion.addProperty('uuid', function () {
    assert.isString(this._obj);
    assert.match(this._obj, uuidPattern);
  });

  Assertion.addProperty('email', function () {
    assert.isString(this._obj);
    assert.match(this._obj, emailPattern);
  });

  Assertion.addProperty('isoDate', function () {
    assert.isString(this._obj);
    assert.isNotNumber(this._obj);
    assert.notEqual(parseInt(this._obj, 10).toString(), this._obj);
  });

  Assertion.addMethod('properties', function (properties) {
    properties.forEach((property) => {
      assert.property(this._obj, property);
    });
  });

  chai.assert.properties = function (obj, properties, msg) {
    new Assertion(obj, msg).to.have.properties(properties);
  };

  Assertion.addMethod('strictProperties', function (properties) {
    properties.forEach((property) => {
      assert.property(this._obj, property);
    });

    assert.deepEqual(Object.keys(this._obj).sort(), properties.sort());
  });

  chai.assert.strictProperties = function (obj, properties, msg) {
    new Assertion(obj, msg).to.have.strictProperties(properties);
  };

  shouldToAssert(chai, {
    hydraId: 'isHydraID',
    uuid: 'isUUID',
    email: 'isEmail',
    isoDate: 'isISODate',
  });
};
