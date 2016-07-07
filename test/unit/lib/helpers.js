/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
var assert = chai.assert;

module.exports = {
  requiresOption: function(fn, option) {
    var pattern = new RegExp('`options.' + option + '` is required');
    try {
      assert.throws(fn, pattern);
    }
    catch (err) {
      return assert.isRejected(fn(), pattern);
    }
  },

  requiresParam: function(fn, param) {
    var pattern = new RegExp('`params.' + param + '` is required');
    try {
      assert.throws(fn, pattern);
    }
    catch (err) {
      return assert.isRejected(fn(), pattern);
    }
  }
};
