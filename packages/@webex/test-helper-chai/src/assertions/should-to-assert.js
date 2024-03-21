/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

const {isArray, camelCase} = require('lodash');

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
  const {Assertion} = chai;
  /* eslint no-unused-expressions: [0] */

  const keys = isArray(names) ? names : Object.keys(names);

  keys.forEach((key) => {
    chai.assert[computeAssertionName(key)] = (obj, msg) => {
      new Assertion(obj, msg).to.be.a[key];
    };
  });

  /**
   * @private
   * @param {string} key
   * @returns {string}
   */
  function computeAssertionName(key) {
    const name = names[key];

    if (name) {
      return name;
    }

    return camelCase(`is_${key}`);
  }
};
