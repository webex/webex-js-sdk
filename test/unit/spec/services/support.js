/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var chai = require('chai');
var MockSpark = require('../../lib/mock-spark');
var Support = require('../../../../src/client/services/support');

var assert = chai.assert;

describe('Services', function() {

  describe('Support', function() {
    var support;

    before(function() {
      var spark = new MockSpark({
        children: {
          support: Support
        },
        client: {
          trackingIdBase: 'random-tracking-id'
        }
      });

      spark.config = {
        trackingIdPrefix: 'tracking-id-prefix'
      };

      support = spark.support;
    });

    describe('_constructFileMetadata', function() {
      it('always adds tracking id to metadata', function() {
        var metadataArray = support._constructFileMetadata({});
        assert.deepEqual(metadataArray, [
          {
            key: 'trackingId',
            value: 'tracking-id-prefix_random-tracking-id'
          }
        ]);
      });

      it('does not add unknown key to metadata', function() {
        var metadata = {
          randomKey: 'random value'
        };
        var metadataArray = support._constructFileMetadata(metadata);
        assert.deepEqual(metadataArray, [
          {
            key: 'trackingId',
            value: 'tracking-id-prefix_random-tracking-id'
          }
        ]);
      });

      ['locusId', 'callStart', 'feedbackId'].forEach(function(key) {
        it('adds ' + key + ' to the metadata array if it is specified', function() {
          var metadata = {};
          metadata[key] = 'value-for-' + key;
          var metadataArray = support._constructFileMetadata(metadata);
          assert.deepEqual(metadataArray, [
            {
              key: key,
              value: 'value-for-' + key
            },
            {
              key: 'trackingId',
              value: 'tracking-id-prefix_random-tracking-id'
            }
          ]);
        });
      });
    });
  });
});
