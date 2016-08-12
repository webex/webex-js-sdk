/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {
  type,
  computed
} from '../..';
import {assert} from '@ciscospark/test-helper-chai';
import sinon from '@ciscospark/test-helper-sinon';

describe(`state`, () => {
  describe(`@computed`, () => {
    const noDepsSpy = sinon.spy();
    const depsSpy = sinon.spy();

    class FormattedDate {
      @type(`number`)
      day

      @type(`number`)
      month

      @type(`number`)
      year

      @type(`string`)
      name

      @computed(function() {
        noDepsSpy();
        return `${this.year}-${this.month}-${this.day}`;
      })
      ISODate

      @computed({
        deps: [
          `day`,
          `month`,
          `year`
        ],
        fn() {
          depsSpy();
          return `${this.day} ${this.month}, ${this.year}`;
        }
      })
      colonialDate
    }

    let fd;
    beforeEach(() => {
      fd = new FormattedDate();
      noDepsSpy.reset();
      depsSpy.reset();
    });

    it(`does not allow values to be set directly`, () => {
      assert.throws(() => {
        fd.ISODate = (new Date()).toISOString();
      }, /Cannot assign to computed property ISODate/);
    });

    describe(`when no deps are specifed`, () => {
      it(`updates on all change events`, () => {
        assert.callCount(depsSpy, 0);
        assert.callCount(noDepsSpy, 0);
        fd.name = `John Doe`;
        assert.callCount(depsSpy, 0);
        assert.callCount(noDepsSpy, 1);
      });
    });

    it(`(optionally) caches updated values`);

    it(`recomputes the property's value when its dependents change`, () => {
      fd.day = 5;
      assert.equal(fd.ISODate, `undefined-undefined-5`);
      fd.month = 10;
      assert.equal(fd.ISODate, `undefined-10-5`);
      fd.year = 2016;
      assert.equal(fd.ISODate, `2016-10-5`);
    });

    it(`fires change events when its value changes`, () => {
      const allSpy = sinon.spy();
      const monthSpy = sinon.spy();

      fd.on(`change`, allSpy);
      fd.on(`change:month`, monthSpy);

      fd.month = 1;
      assert.callCount(allSpy, 1);
      assert.callCount(monthSpy, 1);

      fd.year = 2016;
      assert.callCount(allSpy, 2);
      assert.callCount(monthSpy, 1);
    });
  });
});
