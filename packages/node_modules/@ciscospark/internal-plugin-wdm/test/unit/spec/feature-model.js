/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@ciscospark/test-helper-chai';
import {cloneDeep} from 'lodash';
import {FeatureModel} from '@ciscospark/internal-plugin-wdm';

describe('plugin-wdm', () => {
  describe('FeatureModel', () => {
    describe('#parse()', () => {
      [
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
      ].forEach((def) => {
        const type = def.type;
        const value = def.value;

        it(`parses ${def.attrs.val} as a ${type} during construction`, () => {
          const attrs = cloneDeep(def.attrs);
          const m = new FeatureModel(attrs);
          assert.strictEqual(m.value, value);
          assert.equal(m.type, type);
        });

        it(`parses ${def.attrs.val} as a ${type} when setting new values`, () => {
          const attrs = cloneDeep(def.attrs);
          const m = new FeatureModel();
          m.set(attrs);
          assert.strictEqual(m.value, value);
          assert.equal(m.type, type);
        });
      });
    });
  });
});
