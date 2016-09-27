/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import State, {
  type,
  child
} from '../..';
import {assert} from '@ciscospark/test-helper-chai';
import sinon from '@ciscospark/test-helper-sinon';

describe(`state`, () => {
  describe(`@computed`, () => {
    class C {
      @type(`string`)
      prop
    }

    class A extends State {
      @child(C)
      c
    }

    it(`initializes a new instance of the specifed class`, () => {
      const a = new A();
      const b = new A();
      assert.instanceOf(a.c, C);
      assert.notEqual(a.c, b.c);
    });

    it(`wires up change events`, () => {
      const a = new A();

      const changeSpy = sinon.spy();
      const cSpy = sinon.spy();
      const propSpy = sinon.spy();

      a.on(`change`, changeSpy);
      a.on(`change:c`, cSpy);
      a.on(`change:c.prop`, propSpy);

      a.c.prop = `value`;

      assert.called(changeSpy);
      // This assertion is here match amp-state behavior; not sure I'm sold
      assert.notCalled(cSpy);
      assert.called(propSpy);
    });
  });
});
