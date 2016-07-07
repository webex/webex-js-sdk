/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var chai = require('chai');
var assert = chai.assert;

var uuid = require('uuid');

// TODO move to unit tests
describe('uuid', function() {
  it('generates unique uuids', function() {
    var first = uuid.v4();
    var second = uuid.v4();

    assert.notEqual(first, second);
  });
});
