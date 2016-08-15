/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import State, {
  type,
  computed
} from '../..';
import {assert} from '@ciscospark/test-helper-chai';
import sinon from '@ciscospark/test-helper-sinon';

describe(`state`, () => {
  describe(`@computed`, () => {
    const noDepsSpy = sinon.spy();
    const depsSpy = sinon.spy();

    class FormattedDate extends State {
      @type(`number`)
      day

      @type(`number`)
      month

      @type(`number`)
      year

      @type(`string`)
      name

      @computed({
        deps: [`year`, `month`, `day`],
        fn() {
          noDepsSpy();
          return `${this.year}-${this.month}-${this.day}`;
        }
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

    it(`(optionally) caches updated values`, () => {
      let count = 0;
      class UncachedDemo extends State {
        @computed({
          cache: false,
          fn() {
            count += 1;
            return count * 2;
          }
        })
        double
      }
      const ud = new UncachedDemo();
      const first = ud.double;
      const second = ud.double;
      assert.equal(first, 2);
      assert.equal(second, 4);
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
