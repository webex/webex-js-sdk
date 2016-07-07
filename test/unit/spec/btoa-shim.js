/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var chai = require('chai');
var assert = chai.assert;

/* eslint-disable */
var btoa = require('../../../src/shims/btoa');
/* eslint-enable */

describe('shims', function() {
  describe('btoa()', function() {
    var encoded = 'dGhpcyBpcyBhIHRlc3Q=';
    var unencoded = 'this is a test';

    it('does proper btoa transforms', function() {
      assert.equal(btoa(unencoded), encoded);
    });
  });
});
