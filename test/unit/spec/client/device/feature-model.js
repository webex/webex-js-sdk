/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var assert = require('chai').assert;
var cloneDeep = require('lodash.clonedeep');

var FeatureModel = require('../../../../../src/client/device/feature-model');

describe('Client', function() {
  describe('Device', function() {
    describe('Features', function() {
      describe('Feature Model', function() {

        describe('#parse()', function() {
          var testData = [
            {
              attrs: {val: 'true'},
              type: 'boolean',
              value: true
            },
            {
              attrs: {val: 'false'},
              type: 'boolean',
              value: false
            },
            {
              attrs: {val: '-42'},
              type: 'number',
              value: -42
            },
            {
              attrs: {val: '0'},
              type: 'number',
              value: 0
            },
            {
              attrs: {val: '42'},
              type: 'number',
              value: 42
            },
            {
              attrs: {val: '-24.3'},
              type: 'number',
              value: -24.3
            },
            {
              attrs: {val: '0.0'},
              type: 'number',
              value: 0.0
            },
            {
              attrs: {val: '24.3'},
              type: 'number',
              value: 24.3
            },
            {
              attrs: {val: 'test string'},
              type: 'string',
              value: 'test string'
            },
            {
              attrs: {val: '234test45'},
              type: 'string',
              value: '234test45'
            },
            {
              attrs: {val: ''},
              type: 'string',
              value: ''
            },
            {
              attrs: {val: undefined},
              type: 'string',
              value: undefined
            }
          ];

          testData.forEach(function(data) {
            var type = data.type;
            var value = data.value;

            it('parses "' + data.attrs.val + '" as a `' + type + '` during construction', function() {
              var attrs = cloneDeep(data.attrs);

              var m = new FeatureModel(attrs);
              assert.strictEqual(m.value, value);
              assert.equal(m.type, type);
            });

            it('parses "' + data.attrs.val + '" as a `' + type + '` when setting new values', function() {
              var attrs = cloneDeep(data.attrs);

              var m = new FeatureModel();
              m.set(attrs);
              assert.strictEqual(m.value, value);
              assert.equal(m.type, type);
            });
          });

        });

      });
    });
  });
});
