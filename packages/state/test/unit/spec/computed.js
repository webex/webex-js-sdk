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
      isoDate

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
        fd.isoDate = (new Date()).toISOString();
      }, /Cannot assign to read only property 'isoDate'/);
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

    it(`(optionally) caches updated values`, () => {
      let i = 0;
      class UncachedDemo {
        get now() {
          i += 1;
          return i;
        }

        @computed({
          cache: false,
          fn() {
            return this.now - 10000;
          }
        })
        computed
      }
      const ud = new UncachedDemo();
      const first = ud.computed;
      const second = ud.computed;
      assert.notEqual(first, second);
    });

    it(`recomputes the property's value when its dependents change`, () => {
      fd.day = 5;
      assert.equal(fd.isoDate, `undefined-undefined-5`);
      fd.month = 10;
      assert.equal(fd.isoDate, `undefined-10-5`);
      fd.year = 2016;
      assert.equal(fd.isoDate, `2016-10-5`);
    });

    it(`fires change events when its value changes`, () => {
      const allSpy = sinon.spy();
      const isoDateSpy = sinon.spy();

      fd.on(`change`, allSpy);
      fd.on(`change:isoDate`, isoDateSpy);

      assert.notCalled(allSpy);
      assert.notCalled(isoDateSpy);

      fd.month = 1;
      assert.calledTwice(allSpy);
      assert.calledOnce(isoDateSpy);

      fd.year = 2016;
      assert.callCount(allSpy, 4);
      assert.calledTwice(isoDateSpy);
    });
  });
});
