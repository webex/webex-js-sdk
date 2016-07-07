/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var chai = require('chai');
var MockSpark = require('../../../lib/mock-spark');
var Mashups = require('../../../../../src/client/services/mashups');

var assert = chai.assert;

describe('Services', function() {
  describe('Mashups', function() {
    var spark;

    beforeEach(function() {
      spark = new MockSpark({
        children: {
          mashups: Mashups
        }
      });
    });

    describe('#create()', function() {
      it('throws an error when a type is not provided', function() {
        var promise = spark.mashups.create({
          displayName: 'mashupName'
        });
        return assert.isRejected(promise, /`options.type` is required/);
      });

      it('throws an error when a roomId is not provided', function() {
        var promise = spark.mashups.create({
          displayName: 'mashupName',
          type: 'test'
        });
        return assert.isRejected(promise, /`options.roomId` is required/);
      });
    });

    describe('#remove()', function() {
      it('throws an error when a type is not provided', function() {
        var promise = spark.mashups.remove({
          displayName: 'mashupName'
        });
        return assert.isRejected(promise, /`options.type` is required/);
      });

      it('throws an error when a mashup id is not provided', function() {
        var promise = spark.mashups.remove({
          displayName: 'mashupName',
          type: 'test'
        });
        return assert.isRejected(promise, /`options.id` is required/);
      });
    });
  });
});
