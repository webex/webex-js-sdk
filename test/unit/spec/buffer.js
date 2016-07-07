/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var chai = require('chai');
var assert = chai.assert;

if (typeof window !== 'undefined') {
  describe('Buffer', function() {
    it('has not been browserified', function() {
      assert.throws(function() {
        var moduleName = 'buffer';
        require(moduleName);
      });
    });
  });
}
