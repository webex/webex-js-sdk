/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import State, {
  type,
  required,
  values,
  notNull,
  setOnce,
  test
} from '../..';
import {assert} from '@ciscospark/test-helper-chai';

describe(`State`, () => {
  class PropDemo extends State {
    @type(`string`)
    aString;

    @type(`number`)
    aNumberWithDefault = 1;
  }

  describe(`@type`, () => {
    it(`validates the type of a value about to be set`, () => {
      const pd = new PropDemo();

      assert.throws(() => {
        pd.aString = 5;
      }, TypeError, /newValue must be of type string/);

      assert.doesNotThrow(() => {
        pd.aString = `5`;
      });

      assert.equal(pd.aNumberWithDefault, 1);
      pd.aNumberWithDefault = 2;
      assert.equal(pd.aNumberWithDefault, 2);
      pd.aNumberWithDefault += 1;
      assert.equal(pd.aNumberWithDefault, 3);
    });
  });

  describe(`@required`, () => {
    class RequiredDemo {
      @required
      withDefault = 5

      @required
      withoutDefault
    }

    describe(`when the property has a default`, () => {
      it(`restores the default`, () => {
        const rd = new RequiredDemo();
        assert.equal(rd.withDefault, 5);

        rd.withDefault = 6;
        assert.equal(rd.withDefault, 6);
        rd.withDefault = undefined;
        assert.equal(rd.withDefault, 5);

        rd.withDefault = 6;
        assert.equal(rd.withDefault, 6);
        rd.withDefault = null;
        assert.equal(rd.withDefault, null);
      });
    });

    describe(`when the property does not have a default`, () => {
      it(`does not allow the property to be unset`, () => {
        const rd = new RequiredDemo();
        assert.isUndefined(rd.withoutDefault);

        rd.withoutDefault = 6;
        assert.equal(rd.withoutDefault, 6);
        assert.throws(() => {
          rd.withoutDefault = undefined;
        }, TypeError, /withoutDefault cannot be undefined/);
        assert.equal(rd.withoutDefault, 6);
        rd.withoutDefault = null;
        assert.equal(rd.withoutDefault, null);
      });
    });
  });

  describe(`@values`, () => {
    class ValuesDemo {
      @values([1, 2, 3])
      limitedValues
    }

    it(`only allows the specified values to be set`, () => {
      const vd = new ValuesDemo();
      assert.throws(() => {
        vd.limitedValues = 5;
      }, TypeError, /limitedValues must be one of \(`1`, `2`, `3`\)/);
      assert.isUndefined(vd.limitedValues);

      vd.limitedValues = 2;
      assert.equal(vd.limitedValues, 2);
    });
  });

  describe(`@notNull`, () => {
    class NotNullDemo {
      @notNull
      noNull
    }

    it(`prevents the specified property from being set to null`, () => {
      const nd = new NotNullDemo();
      nd.noNull = 5;
      assert.equal(nd.noNull, 5);
      assert.throws(() => {
        nd.noNull = null;
      }, TypeError, /noNull may not be null/);
    });
  });

  describe(`@setOnce`, () => {
    class SetOnceDemo {
      @setOnce
      justOnceWithDefault = 5

      @setOnce
      justOnce
    }

    describe(`when the property has a default value`, () => {
      it(`does not allow the default to be changed`, () => {
        const sd = new SetOnceDemo();
        assert.throws(() => {
          sd.justOnceWithDefault = 6;
        }, TypeError, /justOnceWithDefault may only be set once/);
      });
    });

    describe(`when the property does not have a default value`, () => {
      it(`allows the property to be set only once`, () => {
        const sd = new SetOnceDemo();
        assert.doesNotThrow(() => {
          sd.justOnce = 1;
        });

        assert.throws(() => {
          sd.justOnce = 2;
        }, TypeError, /justOnce may only be set once/);
      });
    });

  });

  describe(`@test`, () => {
    class TestDemo {
      @test((newValue) => {
        if (newValue < 4) {
          return `tested must be greater than or equal to 4`;
        }
        return false;
      })
      tested
    }

    it(`runs a negative validation test before setting the value`, () => {
      const td = new TestDemo();
      td.tested = 5;
      assert.throws(() => {
        td.tested = 3;
      }, TypeError, /tested must be greater than or equal to 4/);
    });
  });
});
