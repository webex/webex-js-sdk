/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var isArray = require('lodash').isArray;
var S = require('string');

/**
 * Converts expect/should assertion definitions into assert definitions
 * @param {Object} chai
 * @param {Object|Array} names if an Object, keys are should assertions and
 * values are assert assertions; if an array, values are should assertions and
 * assert assertions are computed by capitalizing the first letter and
 * prepending "is".
 * @returns {undefined}
 */
module.exports = function shouldToAssert(chai, names) {
  var Assertion = chai.Assertion;
  /* eslint no-unused-expressions: [0] */

  var keys = isArray(names) ? names : Object.keys(names);
  keys.forEach(function(key) {
    chai.assert[computeAssertionName(key)] = function(obj, msg) {
      new Assertion(obj, msg).to.be.a[key];
    };
  });

  /**
   * @private
   * @param {string} key
   * @returns {string}
   */
  function computeAssertionName(key) {
    var name = names[key];
    if (name) {
      return name;
    }

    return S('is_' + key).camelize().s;
  }
};
