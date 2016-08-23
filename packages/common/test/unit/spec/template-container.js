/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {assert} from '@ciscospark/test-helper-chai';
import {make} from '../..';


describe(`common`, () => {
  describe(`TemplateContainer`, () => {
    describe(`make()`, () => {
      it(`is memoized`, () => {
        const WeakKeyedMap = make(WeakMap, Map);
        const WeakKeyedMap2 = make(WeakMap, Map);

        assert.equal(WeakKeyedMap2, WeakKeyedMap);
      });
    });

    describe(`make(Map)`, () => {
      it(`behaves like a map`, () => {
        const MadeMap = make(Map);

        const key = {};
        const value = 42;

        const m = new MadeMap();

        assert.isFalse(m.has(key));
        m.set(key, value);
        assert.equal(m.get(key), value);
        assert.isTrue(m.has(key));
        assert.isTrue(m.delete(key));
        assert.isFalse(m.has(key));

      });
    });

    describe(`make(WeakMap, Map)`, () => {
      it(`works`, () => {
        const WeakKeyedMap = make(WeakMap, Map);
        class Base {}
        const key = {};
        const value = 42;

        const b = new Base();
        const w = new WeakKeyedMap();

        assert.isFalse(w.has(b, key));
        w.set(b, key, value);
        assert.equal(w.get(b, key), value);
        assert.isTrue(w.has(b, key));
        assert.isTrue(w.delete(b, key));
        assert.isFalse(w.has(b, key));
      });
    });
  });
});
