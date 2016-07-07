/**!
*
* Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
*/

'use strict';

var chai = require('chai');
var Flagging = require('../../../../../src/client/services/flagging');
var MockSpark = require('../../../lib/mock-spark');

var assert = chai.assert;

describe('Services', function() {
  describe('Flagging', function() {
    var spark;

    beforeEach(function() {
      spark = new MockSpark({
        children: {
          flagging: Flagging
        }
      });
    });

    describe('#flag()', function() {
      it('requires an activity URL', function() {
        return assert.isRejected(spark.flagging.flag({}, {}), /`activity.url` is required/);
      });
    });

    describe('#unflag()', function() {
      it('requires a Flag Id', function() {
        return assert.isRejected(spark.flagging.unflag({}, {}), /`flag.id` is required/);
      });
    });

    describe('#archive()', function() {
      it('requires a Flag Id', function() {
        return assert.isRejected(spark.flagging.archive({}, {}), /`flag.id` is required/);
      });
    });

    describe('#remove()', function() {
      it('requires a Flag Id', function() {
        return assert.isRejected(spark.flagging.remove({}, {}), /`flag.id` is required/);
      });
    });

  });
});
